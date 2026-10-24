import { createGeminiTextCompletion } from './gemini.js';
import { createOpenRouterTextCompletion } from './openrouter.js';
import { sanitizeForAI } from './sanitizer.js';

function fallbackHints(input) {
  const suggestions = [];
  const descriptionLength = input.description.trim().length;

  if (descriptionLength < 40) {
    suggestions.push('Add location context, issue size, and how long the problem has existed.');
  }
  if (!/\b(today|yesterday|days|weeks|months)\b/i.test(input.description)) {
    suggestions.push('Mention when you first noticed the issue.');
  }
  if (!/\b(near|opposite|behind|in front of|at)\b/i.test(input.description)) {
    suggestions.push('Add a nearby landmark to help field staff find the exact spot quickly.');
  }

  const improvedTitle = input.title.trim().length < 8
    ? `Civic issue report: ${input.category || 'General'}`
    : null;

  return {
    suggestions: suggestions.slice(0, 3),
    improved_title: improvedTitle,
    category_hint: input.category || null,
    source: 'fallback',
    model: null,
    redactions: 0,
  };
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
    parsed = {};
  }

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((item) => typeof item === 'string').slice(0, 3)
    : [];

  return {
    suggestions,
    improved_title: typeof parsed.improved_title === 'string' ? parsed.improved_title : null,
    category_hint: typeof parsed.category_hint === 'string' ? parsed.category_hint : null,
  };
}

export async function generateDraftHelper(input) {
  const safeTitle = sanitizeForAI(input.title || '');
  const safeDescription = sanitizeForAI(input.description || '');

  if ((safeTitle.sanitized + safeDescription.sanitized).trim().length < 20) {
    return fallbackHints(input);
  }

  if (process.env.AI_FEATURE_DRAFT_HELPER === 'false') {
    return fallbackHints(input);
  }

  const configuredProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

  if (!hasGeminiKey && !hasOpenRouterKey) {
    const fallback = fallbackHints(input);
    return {
      ...fallback,
      redactions: safeTitle.redactions + safeDescription.redactions,
    };
  }

  const providersToTry = [];
  if (configuredProvider === 'gemini') {
    if (hasGeminiKey) providersToTry.push({ name: 'gemini', fn: createGeminiTextCompletion });
    if (hasOpenRouterKey) providersToTry.push({ name: 'openrouter', fn: createOpenRouterTextCompletion });
  } else {
    if (hasOpenRouterKey) providersToTry.push({ name: 'openrouter', fn: createOpenRouterTextCompletion });
    if (hasGeminiKey) providersToTry.push({ name: 'gemini', fn: createGeminiTextCompletion });
  }

  for (const { name: providerName, fn: createTextCompletion } of providersToTry) {
    try {
      const systemPrompt = [
        'You are an assistant helping citizens draft municipal complaints.',
        'Return strict JSON with keys: suggestions (string[]), improved_title (string|null), category_hint (string|null).',
        'Suggestions must be concise and actionable. No markdown.',
        'Do not include personal data in output.',
      ].join(' ');

      const userPrompt = JSON.stringify({
        title: safeTitle.sanitized,
        description: safeDescription.sanitized,
        category: input.category || null,
      });

      const completion = await createTextCompletion(systemPrompt, userPrompt);
      const parsed = parseModelJson(completion?.content);

      return {
        suggestions: parsed.suggestions,
        improved_title: parsed.improved_title,
        category_hint: parsed.category_hint,
        source: 'ai',
        model: completion?.model || providerName,
        redactions: safeTitle.redactions + safeDescription.redactions,
      };
    } catch (err) {
      console.warn(`[DraftHelper] Provider "${providerName}" failed:`, err.message);
    }
  }

  const fallback = fallbackHints(input);
  return {
    ...fallback,
    redactions: safeTitle.redactions + safeDescription.redactions,
  };
}
