/**
 * The HTTP plumbing shared by the real providers.
 *
 * Both OpenAI and Gemini are "POST JSON, read JSON back, and never leak the
 * key", so that lives here once rather than twice. What differs between them —
 * the URL, the auth header, the request shape and the response shape — stays
 * in the provider, because that is the part a reader needs to compare against
 * the vendor's documentation.
 *
 * No SDK. `fetch` is built into Node 22 and these are two ordinary JSON
 * endpoints, so a dependency would buy nothing and cost real things: the
 * serverless bundle grows, and every added package is another chance to repeat
 * the ESM/CJS interop failure that broke this build once already.
 */
import { setTimeout as delay } from 'node:timers/promises';

/**
 * The subset of `fetch` these providers use.
 *
 * Injectable so the provider tests exercise the real request-building and
 * response-reading code without a network or an API key. A test that mocks the
 * provider instead of the transport proves only that the mock works.
 */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface PostJsonOptions {
  url: string;
  /** Provider-specific headers. `Content-Type` is added here. */
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
  /** Identifies the provider in logs and errors. Never a secret. */
  label: string;
  /**
   * The API key, supplied ONLY so it can be scrubbed out of anything that is
   * logged or thrown. Some APIs echo the offending request back in an error
   * body, and an error message is the last place a key should surface.
   */
  secret: string;
  fetchImpl?: FetchLike;
  /** Test seam: lets the retry path run without a real wait. */
  retryDelayMs?: number;
}

/**
 * Statuses where an identical second attempt is genuinely worth making: the
 * request was fine and the far side was momentarily unable to serve it.
 *
 * A 400 or a 401 is excluded on purpose. Re-sending a malformed request or a
 * bad key produces the same answer more slowly.
 */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const MAX_ATTEMPTS = 2;
const MAX_RETRY_DELAY_MS = 5_000;
const MAX_LOGGED_BODY = 500;

/** Replaces the key with a marker wherever it appears. */
function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join('[redacted]');
}

function truncate(text: string): string {
  return text.length <= MAX_LOGGED_BODY ? text : `${text.slice(0, MAX_LOGGED_BODY)}…`;
}

/**
 * Turns a thrown transport failure into a short, safe description.
 *
 * A timeout is named as a timeout because it is the one failure whose fix is a
 * configuration change (`AI_TIMEOUT_MS`) rather than an investigation.
 */
function describeFailure(error: unknown, secret: string): string {
  if (error instanceof Error) {
    // `AbortSignal.timeout` rejects with a DOMException named 'TimeoutError';
    // older runtimes and manual aborts use 'AbortError'.
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'the request timed out';
    }
    return redact(error.message, secret);
  }
  return 'an unknown transport failure';
}

/** Honours `Retry-After` when it is present, sane and short. */
function retryDelayFor(response: Response, fallbackMs: number): number {
  const header = response.headers.get('retry-after');
  if (!header) return fallbackMs;

  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return fallbackMs;

  return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
}

/**
 * POSTs a JSON document and returns the parsed JSON response.
 *
 * Throws on any failure to obtain a 2xx JSON envelope. That is deliberate:
 * `generateValidated` treats a thrown error as a transport failure and does
 * NOT retry it, which is correct here because this function has already made
 * whatever retry was worth making.
 */
export async function postJson(options: PostJsonOptions): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const fallbackDelay = options.retryDelayMs ?? 500;

  let lastFailure = 'no attempt was made';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetchImpl(options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: JSON.stringify(options.body),
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch (error) {
      // A timeout or a dropped socket says nothing about the request itself,
      // so one more attempt is reasonable.
      lastFailure = describeFailure(error, options.secret);
      console.error(`[ai] ${options.label}: attempt ${attempt} failed — ${lastFailure}`);
      if (attempt < MAX_ATTEMPTS) {
        await delay(fallbackDelay);
        continue;
      }
      break;
    }

    if (response.ok) {
      const text = await response.text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        // The ENVELOPE is unparseable — the API itself misbehaved. That is a
        // different failure from the model writing prose instead of JSON,
        // which `extractJsonDocument` handles further down.
        throw new Error(`${options.label}: the API returned a non-JSON envelope`);
      }
    }

    // Read the body for the server log only. It can carry provider detail
    // worth having, and it must never reach the client or keep the key.
    const detail = redact(truncate(await response.text().catch(() => '')), options.secret);
    lastFailure = `HTTP ${response.status}`;
    console.error(`[ai] ${options.label}: ${lastFailure} ${detail}`);

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) break;
    await delay(retryDelayFor(response, fallbackDelay));
  }

  throw new Error(`${options.label}: request failed (${lastFailure})`);
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * Recovers the JSON document a model was asked for from the text it actually
 * produced.
 *
 * Both providers are told to reply with JSON and are put into a JSON response
 * mode, and both still occasionally wrap the document in a code fence or add a
 * sentence of preamble. Unwrapping that is transport-level tidying, not
 * leniency: whatever comes out still goes through the strict schema, so no
 * unchecked field gains entry by this route.
 *
 * WHEN NOTHING PARSES, THE RAW TEXT IS RETURNED RATHER THAN THROWN. That is
 * the important line in this file. `generateValidated` retries a SCHEMA
 * failure once and does not retry a THROWN one — and a model that replied with
 * prose is exactly the case where a second attempt usually succeeds. Throwing
 * here would misfile a recoverable failure as a transport failure and turn a
 * retryable hiccup into a 502.
 */
export function extractJsonDocument(text: string): unknown {
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct.ok) return direct.value;

  // ```json … ``` — added even when the prompt forbids it.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) {
    const inner = tryParse(fenced[1].trim());
    if (inner.ok) return inner.value;
  }

  // A single object with prose either side of it.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const sliced = tryParse(trimmed.slice(first, last + 1));
    if (sliced.ok) return sliced.value;
  }

  return text;
}
