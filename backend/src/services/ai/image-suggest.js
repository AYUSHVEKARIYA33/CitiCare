import { sanitizeForAI } from './sanitizer.js';
import { createGeminiVisionCompletion } from './gemini.js';
import { createOpenRouterVisionCompletion } from './openrouter.js';

const CATEGORY_VALUES = ['roads', 'water', 'electricity', 'garbage', 'sewage', 'street_lights', 'parks', 'other'];

function clampConfidence(value) {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function fallbackImageSuggestion(input, redactions, reason) {
  // No image was analysed successfully: never invent a finding from department order,
  // filenames, an address, or text auto-filled for an earlier photo.
  return {
    suggested_title: '',
    suggested_description: '',
    category_hint: null,
    department_id: null,
    department_name: null,
    suggestions: [
      'Photo analysis is unavailable. Please describe the visible issue and choose its category manually, or retry.',
    ],
    confidence: 0,
    source: 'fallback',
    fallback_reason: reason,
    model: null,
    redactions,
  };
}

function normalizeFallbackReasonFromError(error) {
  const message = String(error?.message || '').toLowerCase();

  if (!message) return 'request_failed';
  if (message.includes('429') || message.includes('resource_exhausted') || message.includes('quota')) return 'quota_exceeded';
  if (message.includes('abort') || message.includes('timeout')) return 'provider_timeout';
  if (message.includes('401') || message.includes('403') || message.includes('api key') || message.includes('auth_failed') || message.includes('permission_denied')) return 'provider_auth_failed';
  if (message.includes('image_model_unavailable') || message.includes('no endpoints found')) return 'provider_model_unavailable';
  if (message.includes('invalid_image_response')) return 'invalid_provider_response';
  if (message.includes('503') || message.includes('high demand') || message.includes('unavailable')) return 'provider_busy';
  return 'provider_request_failed';
}

function bestDepartmentMatch(name, departments = [], categoryHint) {
  if (!departments || !departments.length) return null;

  // Prefer the category actually detected in the photo over an inconsistent name.
  const byCategory = departments.find((dept) => categoryHint && dept.category === categoryHint);
  if (byCategory) return byCategory;
  const normalizedName = (name || '').trim().toLowerCase();
  if (normalizedName) {
    const eligible = departments.filter((dept) => !categoryHint || !dept.category || dept.category === categoryHint);
    const exact = eligible.find((dept) => dept.name.trim().toLowerCase() === normalizedName);
    if (exact) return exact;

    const contains = eligible.find((dept) => dept.name.trim().toLowerCase().includes(normalizedName) || normalizedName.includes(dept.name.trim().toLowerCase()));
    if (contains) return contains;
  }

  if (categoryHint) {
    const byCategory = departments.find((dept) => (dept.category || '').toLowerCase() === categoryHint.toLowerCase());
    if (byCategory) return byCategory;

    const hint = categoryHint.toLowerCase();
    if (hint === 'water') {
      const match = departments.find((d) => /water|pipe|supply|leak/i.test(d.name));
      if (match) return match;
    } else if (hint === 'roads') {
      const match = departments.find((d) => /road|pothole|street|bridge/i.test(d.name));
      if (match) return match;
    } else if (hint === 'sewage') {
      const match = departments.find((d) => /sewage|drain|gutter/i.test(d.name));
      if (match) return match;
    } else if (hint === 'garbage') {
      const match = departments.find((d) => /garbage|waste|solid|clean/i.test(d.name));
      if (match) return match;
    } else if (hint === 'electricity') {
      const match = departments.find((d) => /electric|power/i.test(d.name));
      if (match) return match;
    } else if (hint === 'street_lights') {
      const match = departments.find((d) => /light|lamp|pole/i.test(d.name));
      if (match) return match;
    } else if (hint === 'parks') {
      const match = departments.find((d) => /park|garden|tree/i.test(d.name));
      if (match) return match;
    }
  }

  return null;
}

function parseModelJson(raw) {
  const cleaned = (raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  const jsonText = jsonStart >= 0 && jsonEnd >= jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('invalid_image_response');
  }
  if (!parsed || typeof parsed.suggested_title !== 'string' || !parsed.suggested_title.trim()
      || typeof parsed.suggested_description !== 'string' || !parsed.suggested_description.trim()
      || typeof parsed.category_hint !== 'string') {
    throw new Error('invalid_image_response');
  }

  const category = typeof parsed.category_hint === 'string' ? parsed.category_hint.trim().toLowerCase() : '';
  
  let normalizedCategory = 'other';
  if (/\b(road|pothole|street|divider|pavement|highway)\b/.test(category)) {
    normalizedCategory = 'roads';
  } else if (/\b(water|leak|pipeline|pipe|contamination|tap|hydrant)\b/.test(category)) {
    normalizedCategory = 'water';
  } else if (/\b(electric|power|wire|transformer|spark|current)\b/.test(category)) {
    normalizedCategory = 'electricity';
  } else if (/\b(garbage|trash|waste|bin|dump|litter|cleaning)\b/.test(category)) {
    normalizedCategory = 'garbage';
  } else if (/\b(sewage|drain|sewer|overflow|gutter)\b/.test(category)) {
    normalizedCategory = 'sewage';
  } else if (/\b(light|lamp|pole|dark|bulb)\b/.test(category)) {
    normalizedCategory = 'street_lights';
  } else if (/\b(park|garden|tree|playground|bench)\b/.test(category)) {
    normalizedCategory = 'parks';
  } else if (CATEGORY_VALUES.includes(category)) {
    normalizedCategory = category;
  }

  return {
    suggested_title:
      typeof parsed.suggested_title === 'string' && parsed.suggested_title.trim().length > 0
        ? parsed.suggested_title.trim()
        : 'Civic issue detected from photo',
    suggested_description:
      typeof parsed.suggested_description === 'string' && parsed.suggested_description.trim().length > 0
        ? parsed.suggested_description.trim()
        : 'Issue detected from uploaded image. Please verify details before submitting.',
    category_hint: normalizedCategory,
    department_name: typeof parsed.department_name === 'string' ? parsed.department_name.trim() : null,
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((item) => typeof item === 'string').slice(0, 3)
      : [],
    confidence: clampConfidence(Number.isFinite(parsed.confidence) ? parsed.confidence : 0.5),
  };
}

export async function generateImageSuggestions(input) {
  const safeTitle = sanitizeForAI(input.title || '');
  const safeDescription = sanitizeForAI(input.description || '');
  const safeAddress = sanitizeForAI(input.address || '');
  const redactions = safeTitle.redactions + safeDescription.redactions + safeAddress.redactions;

  if (process.env.AI_FEATURE_IMAGE_HELPER === 'false') {
    return fallbackImageSuggestion(input, redactions, 'feature_disabled');
  }

  const configuredProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

  if (!hasGeminiKey && !hasOpenRouterKey) {
    return fallbackImageSuggestion(input, redactions, 'missing_api_key');
  }

  const availableDepartments = (input.departments || []).map((dept) => ({
    id: dept.id,
    name: dept.name,
    category: dept.category || null,
  }));

  const systemPrompt = [
    'You assist citizens filing municipal complaints from images.',
    'Carefully inspect the image to detect the civic problem (e.g. water pipe burst, leaking water, road pothole, overflowing garbage, broken street light, fallen wire, sewage overflow, damaged park).',
    'The image is the primary evidence. Existing title, description and address may refer to a previous photo; do not repeat them when they conflict with the image.',
    'Classify leaking or burst clean-water pipes as water, not roads just because a road is visible.',
    'Return strict JSON with keys: suggested_title, suggested_description, category_hint, department_name, suggestions, confidence.',
    'category_hint must be exactly one of: roads, water, electricity, garbage, sewage, street_lights, parks, other.',
    'department_name must be chosen from the available_departments list that best handles this problem.',
    'suggested_title should be a concise, clear title of the issue (e.g. "Burst water main spraying water").',
    'suggested_description should be 1-2 detailed sentences describing what is visible in the photo.',
    'Describe the visible defect, affected object and visible impact. Do not invent buried infrastructure, duration, location, severity or damage that cannot be seen.',
    'If no civic problem can be identified, use category other and explain the uncertainty. Never default to the first department.',
    'Suggestions are for citizens: request useful reporting details, not instructions to repair pipes or operate municipal equipment.',
    'suggestions should be short and actionable (max 3).',
    'confidence is a number between 0.0 and 1.0.',
    'Never include personal data in outputs.',
  ].join(' ');

  const contextPayload = {
    title: safeTitle.sanitized || null,
    description: safeDescription.sanitized || null,
    address: safeAddress.sanitized || null,
    available_departments: availableDepartments,
  };

  // Build provider execution order: configured provider first, then secondary as fallback
  const providersToTry = [];
  if (configuredProvider === 'gemini') {
    if (hasGeminiKey) providersToTry.push({ name: 'gemini', fn: createGeminiVisionCompletion });
    if (hasOpenRouterKey) providersToTry.push({ name: 'openrouter', fn: createOpenRouterVisionCompletion });
  } else {
    if (hasOpenRouterKey) providersToTry.push({ name: 'openrouter', fn: createOpenRouterVisionCompletion });
    if (hasGeminiKey) providersToTry.push({ name: 'gemini', fn: createGeminiVisionCompletion });
  }

  let lastError = null;

  // Both providers must finish inside the photo request's 45-second client timeout.
  const deadline = Date.now() + 35000;
  for (const [index, { name: providerName, fn: createVisionCompletion }] of providersToTry.entries()) {
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('provider_timeout');
      const completion = await createVisionCompletion({
        systemPrompt,
        contextPayload,
        imageBuffer: input.imageBuffer,
        mimeType: input.mimeType,
        timeoutMs: Math.max(1, Math.floor(remaining / (providersToTry.length - index))),
      });

      const content = completion?.content;
      const modelUsed = completion?.model || providerName;

      if (content) {
        const parsed = parseModelJson(content);
        const matchedDepartment = bestDepartmentMatch(parsed.department_name, input.departments, parsed.category_hint);

        return {
          suggested_title: parsed.suggested_title,
          suggested_description: parsed.suggested_description,
          category_hint: parsed.category_hint,
          department_id: matchedDepartment?.id ?? null,
          department_name: matchedDepartment?.name ?? parsed.department_name,
          suggestions: parsed.suggestions,
          confidence: parsed.confidence,
          source: 'ai',
          model: modelUsed,
          redactions,
        };
      }
      throw new Error('invalid_image_response');
    } catch (err) {
      console.warn(`[AI Vision] Provider "${providerName}" failed:`, normalizeFallbackReasonFromError(err));
      lastError = err;
    }
  }

  return fallbackImageSuggestion(input, redactions, normalizeFallbackReasonFromError(lastError));
}
