/**
 * The real providers, with the network replaced and nothing else.
 *
 * `fetchImpl` is injected, so what runs here is the ACTUAL request building,
 * response reading, retry policy and redaction — the parts that can be wrong.
 * A test that stubbed `generate` instead would only prove the stub works.
 *
 * No API key and no network are involved. The keys below are fake and are also
 * the subject of the redaction tests, which is why they are distinctive.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiProvider } from '../src/services/ai/GeminiProvider.js';
import { OpenAIProvider } from '../src/services/ai/OpenAIProvider.js';
import { extractJsonDocument } from '../src/services/ai/http.js';
import type { AIRequest } from '../src/services/ai/AIProvider.js';

const OPENAI_KEY = 'sk-test-NOT-A-REAL-KEY-0123456789';
const GEMINI_KEY = 'AIza-test-NOT-A-REAL-KEY-0123456789';

const REQUEST: AIRequest = {
  task: 'daily',
  system: 'You write for The Little Universe.',
  user: 'Write today’s reading for Friday, 2026-08-28.',
  seed: '2026-08-28:visitor:abc',
};

/** A schema-shaped document, so a provider returning it is returning content. */
const DOCUMENT = { theme: 'Unexpected Moments', energyScore: 88 };

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * A transport that replays a queued list of responses and records what it was
 * asked to send. The last entry repeats, so a test that only cares about the
 * request can queue one response.
 */
function stubFetch(responses: Array<{ status?: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  const queue = [...responses];

  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers, body: JSON.parse(String(init.body)) as Record<string, unknown> });

    const next = queue.length > 1 ? queue.shift() : queue[0];
    const status = next?.status ?? 200;
    const payload = typeof next?.body === 'string' ? next.body : JSON.stringify(next?.body);

    return new Response(payload, { status, headers: next?.headers });
  };

  return { fetchImpl, calls };
}

const openAIReply = (content: string, extra: Record<string, unknown> = {}) => ({
  body: { choices: [{ message: { content }, finish_reason: 'stop', ...extra }] },
});

const geminiReply = (text: string, extra: Record<string, unknown> = {}) => ({
  body: { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP', ...extra }] },
});

// --- OpenAI: the request it builds ------------------------------------------
test('OpenAI is asked for JSON, with the system prompt separated from the turn', async () => {
  const stub = stubFetch([openAIReply(JSON.stringify(DOCUMENT))]);
  const provider = new OpenAIProvider({
    apiKey: OPENAI_KEY,
    model: 'gpt-4o-mini',
    fetchImpl: stub.fetchImpl,
    temperature: 0.9,
    maxTokens: 900,
  });

  const result = await provider.generate(REQUEST);
  assert.deepEqual(result, DOCUMENT);

  const call = stub.calls[0];
  assert.ok(call);
  assert.equal(call.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(call.headers['Authorization'], `Bearer ${OPENAI_KEY}`);
  assert.equal(call.body['model'], 'gpt-4o-mini');
  // JSON mode is what stops a stray sentence of preamble in the common case.
  assert.deepEqual(call.body['response_format'], { type: 'json_object' });
  assert.equal(call.body['temperature'], 0.9);
  assert.equal(call.body['max_completion_tokens'], 900);
  assert.deepEqual(call.body['messages'], [
    { role: 'system', content: REQUEST.system },
    { role: 'user', content: REQUEST.user },
  ]);
});

test('the per-request token budget overrides the provider default', async () => {
  // This is what keeps a seven-day forecast from being truncated mid-object.
  const stub = stubFetch([openAIReply(JSON.stringify(DOCUMENT))]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl, maxTokens: 900 });

  await provider.generate({ ...REQUEST, task: 'weekly', maxTokens: 3000 });
  assert.equal(stub.calls[0]?.body['max_completion_tokens'], 3000);
});

test('the seed is NOT sent: a real provider varies on purpose', async () => {
  // The seed exists to make the mock reproducible. Passing it to OpenAI would
  // pin the output and undo the uniqueness a real provider is here to deliver.
  const stub = stubFetch([openAIReply(JSON.stringify(DOCUMENT))]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl });

  await provider.generate(REQUEST);
  assert.equal(stub.calls[0]?.body['seed'], undefined);
});

test('the provider name carries the model, so a stored row stays attributable', () => {
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, model: 'gpt-4o' });
  assert.equal(provider.name, 'openai:gpt-4o');
});

test('constructing OpenAIProvider without a key fails immediately', () => {
  assert.throws(() => new OpenAIProvider({ apiKey: '' }), /OPENAI_API_KEY/);
});

// --- OpenAI: the responses it reads -----------------------------------------
test('a fenced JSON document is unwrapped rather than rejected', async () => {
  const stub = stubFetch([openAIReply('```json\n' + JSON.stringify(DOCUMENT) + '\n```')]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl });

  assert.deepEqual(await provider.generate(REQUEST), DOCUMENT);
});

test('unparseable output is RETURNED, not thrown, so the schema gate can retry', async () => {
  // The distinction that matters: `generateValidated` retries a schema
  // failure once and does not retry a thrown one. A model that replied with
  // prose usually succeeds on the second attempt, so it must arrive as data.
  const stub = stubFetch([openAIReply('I am afraid I cannot write that today.')]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl });

  const result = await provider.generate(REQUEST);
  assert.equal(typeof result, 'string');
});

test('a refusal throws instead of burning the retry on an identical prompt', async () => {
  const stub = stubFetch([{ body: { choices: [{ message: { refusal: 'I cannot help with that.' } }] } }]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl });

  await assert.rejects(() => provider.generate(REQUEST), /declined/);
});

test('an unrecognisable envelope is a controlled error, not a crash', async () => {
  const stub = stubFetch([{ body: { choices: [] } }]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl });

  await assert.rejects(() => provider.generate(REQUEST), /unexpected response envelope/);
});

// --- transport behaviour ----------------------------------------------------
test('a 429 is retried once and then succeeds', async () => {
  const stub = stubFetch([
    { status: 429, body: { error: { message: 'rate limited' } } },
    openAIReply(JSON.stringify(DOCUMENT)),
  ]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl, retryDelayMs: 0 });

  assert.deepEqual(await provider.generate(REQUEST), DOCUMENT);
  assert.equal(stub.calls.length, 2);
});

test('a 400 is NOT retried: the same bad request gets the same answer', async () => {
  const stub = stubFetch([{ status: 400, body: { error: { message: 'bad request' } } }]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl, retryDelayMs: 0 });

  await assert.rejects(() => provider.generate(REQUEST), /HTTP 400/);
  assert.equal(stub.calls.length, 1, 'a client error must not be re-sent');
});

test('a persistent 503 stops after two attempts rather than hammering', async () => {
  const stub = stubFetch([{ status: 503, body: 'unavailable' }]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl, retryDelayMs: 0 });

  await assert.rejects(() => provider.generate(REQUEST));
  assert.equal(stub.calls.length, 2);
});

test('a non-JSON envelope from the API is reported as such', async () => {
  const stub = stubFetch([{ body: '<html>502 Bad Gateway</html>' }]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl });

  await assert.rejects(() => provider.generate(REQUEST), /non-JSON envelope/);
});

// --- the API key never escapes ----------------------------------------------
test('the key does not appear in a thrown error, even when the API echoes it', async () => {
  // Some APIs quote the offending request back. An error message travels into
  // logs and, if anyone is careless, into a response.
  const stub = stubFetch([
    { status: 401, body: { error: { message: `Incorrect API key provided: ${OPENAI_KEY}` } } },
  ]);
  const provider = new OpenAIProvider({ apiKey: OPENAI_KEY, fetchImpl: stub.fetchImpl, retryDelayMs: 0 });

  await assert.rejects(
    () => provider.generate(REQUEST),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.ok(!message.includes(OPENAI_KEY), 'the API key must not reach an error message');
      assert.match(message, /HTTP 401/);
      return true;
    },
  );
});

test('a transport failure carrying the key is scrubbed too', async () => {
  const provider = new OpenAIProvider({
    apiKey: OPENAI_KEY,
    retryDelayMs: 0,
    fetchImpl: async () => {
      throw new Error(`socket hang up while sending Bearer ${OPENAI_KEY}`);
    },
  });

  await assert.rejects(
    () => provider.generate(REQUEST),
    (error: unknown) => {
      assert.ok(!(error as Error).message.includes(OPENAI_KEY));
      return true;
    },
  );
});

test('the Gemini key travels in a header, never in the URL', async () => {
  // A URL is the part of a request that reaches proxy logs and stack traces.
  const stub = stubFetch([geminiReply(JSON.stringify(DOCUMENT))]);
  const provider = new GeminiProvider({ apiKey: GEMINI_KEY, fetchImpl: stub.fetchImpl });

  await provider.generate(REQUEST);
  const call = stub.calls[0];
  assert.ok(call);
  assert.ok(!call.url.includes(GEMINI_KEY), 'the key must not be a query parameter');
  assert.equal(call.headers['x-goog-api-key'], GEMINI_KEY);
});

// --- Gemini: the request it builds ------------------------------------------
test('Gemini receives a system instruction and a JSON response type', async () => {
  const stub = stubFetch([geminiReply(JSON.stringify(DOCUMENT))]);
  const provider = new GeminiProvider({
    apiKey: GEMINI_KEY,
    model: 'gemini-2.0-flash',
    fetchImpl: stub.fetchImpl,
    temperature: 0.9,
    maxTokens: 900,
  });

  assert.deepEqual(await provider.generate(REQUEST), DOCUMENT);

  const call = stub.calls[0];
  assert.ok(call);
  assert.equal(
    call.url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  );
  assert.deepEqual(call.body['systemInstruction'], { parts: [{ text: REQUEST.system }] });
  assert.deepEqual(call.body['contents'], [{ role: 'user', parts: [{ text: REQUEST.user }] }]);
  assert.deepEqual(call.body['generationConfig'], {
    temperature: 0.9,
    maxOutputTokens: 900,
    responseMimeType: 'application/json',
  });
});

test('a models/ prefix on the configured model is not doubled in the URL', async () => {
  const stub = stubFetch([geminiReply(JSON.stringify(DOCUMENT))]);
  const provider = new GeminiProvider({
    apiKey: GEMINI_KEY,
    model: 'models/gemini-2.0-flash',
    fetchImpl: stub.fetchImpl,
  });

  await provider.generate(REQUEST);
  assert.ok(!stub.calls[0]?.url.includes('models/models/'));
  assert.equal(provider.name, 'gemini:gemini-2.0-flash');
});

// --- Gemini: the responses it reads -----------------------------------------
test('a reply split across parts is joined, not truncated to the first', async () => {
  const json = JSON.stringify(DOCUMENT);
  const half = Math.floor(json.length / 2);
  const stub = stubFetch([
    {
      body: {
        candidates: [
          {
            content: { parts: [{ text: json.slice(0, half) }, { text: json.slice(half) }] },
            finishReason: 'STOP',
          },
        ],
      },
    },
  ]);
  const provider = new GeminiProvider({ apiKey: GEMINI_KEY, fetchImpl: stub.fetchImpl });

  // Taking parts[0] alone would silently drop the rest of every chunked reading.
  assert.deepEqual(await provider.generate(REQUEST), DOCUMENT);
});

test('a blocked prompt is reported as blocked, not as invalid output', async () => {
  // A safety block arrives as a 200 with no candidates at all.
  const stub = stubFetch([{ body: { promptFeedback: { blockReason: 'SAFETY' } } }]);
  const provider = new GeminiProvider({ apiKey: GEMINI_KEY, fetchImpl: stub.fetchImpl });

  await assert.rejects(() => provider.generate(REQUEST), /blocked \(SAFETY\)/);
});

test('a candidate that stopped for RECITATION is an error, not empty content', async () => {
  const stub = stubFetch([{ body: { candidates: [{ finishReason: 'RECITATION' }] } }]);
  const provider = new GeminiProvider({ apiKey: GEMINI_KEY, fetchImpl: stub.fetchImpl });

  await assert.rejects(() => provider.generate(REQUEST), /stopped early \(RECITATION\)/);
});

test('a truncated MAX_TOKENS reply still reaches the schema gate for a retry', async () => {
  const stub = stubFetch([geminiReply('{"theme":"Unexpected Mom', { finishReason: 'MAX_TOKENS' })]);
  const provider = new GeminiProvider({ apiKey: GEMINI_KEY, fetchImpl: stub.fetchImpl });

  // Truncation is logged as a token-budget problem, but the fragment is
  // returned rather than thrown so the one retry is still available.
  assert.equal(typeof (await provider.generate(REQUEST)), 'string');
});

test('constructing GeminiProvider without a key fails immediately', () => {
  assert.throws(() => new GeminiProvider({ apiKey: '' }), /GEMINI_API_KEY/);
});

// --- document extraction ----------------------------------------------------
test('extractJsonDocument recovers a document from prose, fences, or neither', () => {
  assert.deepEqual(extractJsonDocument('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJsonDocument('  \n {"a":1}\n '), { a: 1 });
  assert.deepEqual(extractJsonDocument('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJsonDocument('```\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJsonDocument('Here you are:\n{"a":1}\nHope that helps.'), { a: 1 });

  // Nothing recoverable: the raw text comes back so the schema rejects it and
  // the retry happens. Returning `{}` or null here would hide the failure.
  assert.equal(extractJsonDocument('no json at all'), 'no json at all');
  assert.equal(extractJsonDocument(''), '');
});

test('extraction does not let an extra field in through the back door', () => {
  // Unwrapping is transport tidying, not leniency — what comes out still
  // faces the strict schema, so nothing gains entry by being fenced.
  const unwrapped = extractJsonDocument('```json\n{"a":1,"prophecy":"riches"}\n```');
  assert.deepEqual(unwrapped, { a: 1, prophecy: 'riches' });
});
