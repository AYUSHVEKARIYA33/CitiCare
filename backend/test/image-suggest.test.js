import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Import without loading .env: tests never use real credentials or a real network.
process.env.GEMINI_API_KEY = 'test-only';
process.env.OPENROUTER_API_KEY = 'test-only';
process.env.GEMINI_MODEL_VISION = 'test-vision';
process.env.OPENROUTER_VISION_MODEL = 'test-vision';
process.env.AI_TIMEOUT_MS = '50';
process.env.AI_PROVIDER = 'gemini';
const { generateImageSuggestions } = await import('../src/services/ai/image-suggest.js');
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.GEMINI_API_KEY = 'test-only';
  process.env.OPENROUTER_API_KEY = 'test-only';
  delete process.env.AI_FEATURE_IMAGE_HELPER;
});
const input = () => ({ imageBuffer: Buffer.from('synthetic-photo'), mimeType: 'image/png', filename: 'screenshot.png', title: '', description: '', address: '', departments: [
  { id: 'roads', name: 'Roads & Potholes', category: 'roads' },
  { id: 'water', name: 'Water Supply', category: 'water' },
] });
const water = { suggested_title: 'Water spraying from a broken pipe joint', suggested_description: 'Water is spraying from the joint of an exposed pipe. The surrounding wall and ground are wet.', category_hint: 'water', department_name: 'Water Supply', confidence: 0.96, suggestions: ['Include the nearest landmark.'] };
const response = (status, value) => ({ ok: status >= 200 && status < 300, status, text: async () => typeof value === 'string' ? value : JSON.stringify(value), json: async () => value });
const gemini = data => response(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] });

test('actual image bytes reach vision and a pipe result selects water instead of the first department', async () => {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const image = body.contents[0].parts[1].inline_data;
    assert.equal(image.data, input().imageBuffer.toString('base64'));
    assert.equal(image.mime_type, 'image/png');
    return gemini(water);
  };
  const result = await generateImageSuggestions(input());
  assert.equal(result.source, 'ai');
  assert.equal(result.category_hint, 'water');
  assert.equal(result.department_id, 'water');
  assert.equal(result.suggested_description, water.suggested_description);
});

test('authentication failure switches provider once instead of retrying the same rejected credential', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url.includes('googleapis')) return response(403, 'authentication failed');
    assert.ok(JSON.parse(options.body).messages[1].content[1].image_url.url.startsWith('data:image/png;base64,'));
    return response(200, { choices: [{ message: { content: JSON.stringify(water) } }] });
  };
  assert.equal((await generateImageSuggestions(input())).source, 'ai');
  assert.equal(calls.length, 2);
});

test('both rejected credentials produce no fabricated category, description or confidence', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response(401, 'invalid API key'); };
  const result = await generateImageSuggestions({ ...input(), title: 'Old road complaint', address: 'Road Street' });
  assert.equal(calls, 2);
  assert.equal(result.source, 'fallback');
  assert.equal(result.fallback_reason, 'provider_auth_failed');
  assert.equal(result.category_hint, null);
  assert.equal(result.department_id, null);
  assert.equal(result.suggested_description, '');
  assert.equal(result.suggested_title, '');
  assert.equal(result.confidence, 0);
});

test('missing keys or disabled feature never guess from department order', async () => {
  globalThis.fetch = async () => { throw Error('Network must not be called'); };
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  let result = await generateImageSuggestions(input());
  assert.equal(result.fallback_reason, 'missing_api_key');
  assert.equal(result.department_id, null);
  process.env.AI_FEATURE_IMAGE_HELPER = 'false';
  result = await generateImageSuggestions(input());
  assert.equal(result.fallback_reason, 'feature_disabled');
});

test('invalid or incomplete model JSON cannot masquerade as a successful generic description', async () => {
  globalThis.fetch = async url => url.includes('googleapis') ? gemini({ suggested_title: 'Incomplete', category_hint: 'roads' })
    : response(200, { choices: [{ message: { content: '{broken json' } }] });
  const result = await generateImageSuggestions(input());
  assert.equal(result.source, 'fallback');
  assert.equal(result.fallback_reason, 'invalid_provider_response');
  assert.equal(result.suggested_description, '');
});

test('a valid category overrides an inconsistent department name; unmatched categories stay unassigned', async () => {
  globalThis.fetch = async () => gemini({ ...water, department_name: 'Roads & Potholes' });
  assert.equal((await generateImageSuggestions(input())).department_id, 'water');
  globalThis.fetch = async () => gemini({ ...water, category_hint: 'parks', department_name: 'Roads & Potholes' });
  assert.equal((await generateImageSuggestions(input())).department_id, null);
});

test('quota and timeouts stop same-provider retries and leave room for the secondary provider', async () => {
  let primaryCalls = 0;
  globalThis.fetch = async url => {
    if (url.includes('googleapis')) { primaryCalls++; return response(429, 'quota exhausted'); }
    return response(200, { choices: [{ message: { content: JSON.stringify(water) } }] });
  };
  assert.equal((await generateImageSuggestions(input())).category_hint, 'water');
  assert.equal(primaryCalls, 1);
  globalThis.fetch = async (_url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  const start = Date.now();
  const result = await generateImageSuggestions(input());
  assert.equal(result.fallback_reason, 'provider_timeout');
  assert.ok(Date.now() - start < 1000);
});
