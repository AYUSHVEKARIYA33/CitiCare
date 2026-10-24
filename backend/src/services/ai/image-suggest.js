import { sanitizeForAI } from './sanitizer.js';
import { createGeminiVisionCompletion } from './gemini.js';
import { createOpenRouterVisionCompletion } from './openrouter.js';

const CATEGORY_VALUES = ['roads', 'water', 'electricity', 'garbage', 'sewage', 'street_lights', 'parks', 'other'];

function clampConfidence(value) {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function detectCategoryFromText(value) {
  const text = (value || '').toLowerCase();
  if (!text.trim()) return null;
  if (/\b(pothole|road|street|asphalt|traffic|divider|highway|pavement)\b/.test(text)) return 'roads';
  if (/\b(water|leak|pipeline|pipe|tap|supply|burst|flooding|hydrant)\b/.test(text)) return 'water';
  if (/\b(garbage|trash|waste|dump|bin|litter|cleaning)\b/.test(text)) return 'garbage';
  if (/\b(sewage|drain|drainage|sewer|gutter|overflow)\b/.test(text)) return 'sewage';
  if (/\b(street light|streetlight|lamp post|lamp|dark|bulb|pole)\b/.test(text)) return 'street_lights';
  if (/\b(electric|power|voltage|wire|transformer|spark|current)\b/.test(text)) return 'electricity';
  if (/\b(park|garden|tree|playground|bench|branch)\b/.test(text)) return 'parks';
  return null;
}

function fallbackImageSuggestion(input, redactions, reason) {
  const textBlob = [
    input.filename || '',
    input.title || '',
    input.description || '',
    input.address || '',
  ].join(' ');

  let likelyCategory = detectCategoryFromText(textBlob);
  if (!likelyCategory) {
    const withCat = (input.departments || []).find((d) => d.category && d.category !== 'other');
    likelyCategory = withCat?.category || 'water';
  }

  const fallbackDepartment = bestDepartmentMatch(null, input.departments, likelyCategory);

  const titlesByCategory = {
    water: 'Water pipeline leakage and supply disruption',
    roads: 'Road damage and pothole repair required',
    sewage: 'Sewage overflow and drainage blockage',
    garbage: 'Accumulated garbage and waste clearance needed',
    street_lights: 'Street light malfunction / non-functional light',
    electricity: 'Electrical line or power infrastructure issue',
    parks: 'Public park or garden maintenance required',
    other: 'Civic infrastructure issue reported from photo',
  };

  const descriptionsByCategory = {
    water: 'Severe water leakage or pipeline damage observed from the photo. Immediate municipal repair is required to prevent water wastage and local flooding.',
    roads: 'Damaged road surface / pothole detected in uploaded photo. Road maintenance and resurfacing required for public safety.',
    sewage: 'Drainage or sewer blockage causing overflow. Desilting and pipeline clearance requested.',
    garbage: 'Uncollected garbage accumulation observed. Municipal sanitation team requested to clear the area.',
    street_lights: 'Damaged or inactive street light pole reported. Electrical inspection and fixture replacement needed.',
    electricity: 'Electrical wiring or infrastructure safety concern detected. Power department inspection requested.',
    parks: 'Park maintenance or tree branch hazard observed. Gardening and maintenance team requested.',
    other: 'Issue detected from uploaded image. Please add exact location details, problem duration, and impact for faster resolution.',
  };

  return {
    suggested_title: input.title?.trim() || titlesByCategory[likelyCategory] || 'Civic issue reported from uploaded photo',
    suggested_description:
      input.description?.trim() ||
      descriptionsByCategory[likelyCategory] ||
      'Issue detected from uploaded image. Please add exact location details, problem duration, and impact for faster resolution.',
    category_hint: likelyCategory,
    department_id: fallbackDepartment?.id ?? null,
    department_name: fallbackDepartment?.name ?? null,
    suggestions: [
      'Add the nearest landmark and lane/house number if available.',
      'Mention when the issue started and whether it is worsening.',
      'Describe safety impact (traffic, water logging, night visibility, etc.).',
    ],
    confidence: 0.55,
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
  if (message.includes('503') || message.includes('high demand') || message.includes('unavailable')) return 'provider_busy';
  if (message.includes('image_model_unavailable') || message.includes('no endpoints found')) return 'provider_model_unavailable';
  return 'provider_request_failed';
}

function bestDepartmentMatch(name, departments = [], categoryHint) {
  if (!departments || !departments.length) return null;

  const normalizedName = (name || '').trim().toLowerCase();
  if (normalizedName) {
    const exact = departments.find((dept) => dept.name.trim().toLowerCase() === normalizedName);
    if (exact) return exact;

    const contains = departments.find((dept) => dept.name.trim().toLowerCase().includes(normalizedName) || normalizedName.includes(dept.name.trim().toLowerCase()));
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

  return departments[0] ?? null;
}

function parseModelJson(raw) {
  const cleaned = (raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  const jsonText = jsonStart >= 0 && jsonEnd >= jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  let parsed = {};
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const titleMatch = raw.match(/"suggested_title"\s*:\s*"([^"]+)"/i);
    const descMatch = raw.match(/"suggested_description"\s*:\s*"([^"]+)"/i);
    const catMatch = raw.match(/"category_hint"\s*:\s*"([^"]+)"/i);
    const deptMatch = raw.match(/"department_name"\s*:\s*"([^"]+)"/i);
    parsed = {
      suggested_title: titleMatch?.[1] || null,
      suggested_description: descMatch?.[1] || null,
      category_hint: catMatch?.[1] || null,
      department_name: deptMatch?.[1] || null,
    };
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
    confidence: clampConfidence(typeof parsed.confidence === 'number' ? parsed.confidence : 0.85),
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
    'Return strict JSON with keys: suggested_title, suggested_description, category_hint, department_name, suggestions, confidence.',
    'category_hint must be exactly one of: roads, water, electricity, garbage, sewage, street_lights, parks, other.',
    'department_name must be chosen from the available_departments list that best handles this problem.',
    'suggested_title should be a concise, clear title of the issue (e.g. "Burst water main spraying water").',
    'suggested_description should be 1-2 detailed sentences describing what is visible in the photo.',
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

  for (const { name: providerName, fn: createVisionCompletion } of providersToTry) {
    try {
      const completion = await createVisionCompletion({
        systemPrompt,
        contextPayload,
        imageBuffer: input.imageBuffer,
        mimeType: input.mimeType,
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
    } catch (err) {
      console.warn(`[AI Vision] Provider "${providerName}" failed:`, err.message);
      lastError = err;
    }
  }

  return fallbackImageSuggestion(input, redactions, normalizeFallbackReasonFromError(lastError));
}
