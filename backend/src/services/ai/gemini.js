const GEMINI_API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_TEXT_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
].filter(Boolean);
const GEMINI_VISION_MODELS = [
  process.env.GEMINI_MODEL_VISION,
  'gemini-flash-latest',
].filter((model, index, models) => model && models.indexOf(model) === index);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 35000);

function extractGeminiText(payload) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) {
    throw new Error(payload.error?.message || 'Gemini response did not include content');
  }

  return text;
}

async function callGemini(model, body, timeoutMs = AI_TIMEOUT_MS) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      const lowered = detail.toLowerCase();
      if (response.status === 429 || lowered.includes('resource_exhausted') || lowered.includes('quota')) {
        throw new Error('Gemini request failed: quota_exceeded');
      }
      if (response.status === 401 || response.status === 403 || lowered.includes('api key')) {
        throw new Error('Gemini request failed: auth_failed');
      }
      throw new Error(`Gemini request failed: status_${response.status} - ${detail}`);
    }

    const json = await response.json();
    return extractGeminiText(json);
  } finally {
    clearTimeout(timeout);
  }
}

export async function createGeminiTextCompletion(systemPrompt, userPrompt) {
  let lastError = null;
  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const content = await callGemini(model, {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });
      return { content, model };
    } catch (err) {
      console.warn(`[Gemini Text] Model "${model}" failed:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini text models failed');
}

export async function createGeminiVisionCompletion(input) {
  let lastError = null;
  const deadline = Date.now() + Math.min(input.timeoutMs || AI_TIMEOUT_MS, AI_TIMEOUT_MS);
  for (const model of GEMINI_VISION_MODELS) {
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('provider_timeout');
      const content = await callGemini(model, {
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Context JSON: ${JSON.stringify(input.contextPayload)}` },
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.imageBuffer.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }, remaining);
      return { content, model };
    } catch (err) {
      lastError = err;
      // Changing models cannot repair credentials, exhausted quota or a timeout.
      if (/auth_failed|quota_exceeded|abort|timeout/i.test(err.message)) break;
    }
  }
  throw lastError || new Error('All Gemini vision models failed');
}
