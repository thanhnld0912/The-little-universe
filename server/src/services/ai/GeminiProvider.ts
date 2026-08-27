/**
 * Google Gemini, over the Generative Language REST API.
 *
 * The same contract as every provider: two blocks of finished text in,
 * unvalidated model output out. See `OpenAIProvider` for why `seed` is ignored
 * and why a real provider is what actually makes readings unique.
 *
 * The key travels in the `x-goog-api-key` header rather than the `?key=` query
 * parameter the quickstart uses. Both authenticate; only one keeps the secret
 * out of the URL, and URLs are the part of a request that ends up in error
 * messages, proxy logs and stack traces.
 */
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { AIProvider, AIRequest } from './AIProvider.js';
import { extractJsonDocument, postJson, type FetchLike } from './http.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  /** Test seams. */
  fetchImpl?: FetchLike;
  retryDelayMs?: number;
}

/**
 * Only the fields that are read. Unknown keys are stripped: this is Google's
 * envelope, not model output.
 *
 * Everything is optional because a BLOCKED request is a 200 with no
 * candidates at all. Declaring `candidates` required would turn that into
 * "unexpected envelope" and hide the actual reason.
 */
const responseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
});

/** Accepts either `gemini-2.0-flash` or `models/gemini-2.0-flash`. */
function bareModelName(model: string): string {
  return model.startsWith('models/') ? model.slice('models/'.length) : model;
}

export class GeminiProvider implements AIProvider {
  /** Carries the model, so a stored row's origin stays unambiguous. */
  readonly name: string;

  readonly #apiKey: string;
  readonly #model: string;
  readonly #temperature: number;
  readonly #timeoutMs: number;
  readonly #maxTokens: number;
  readonly #fetchImpl: FetchLike | undefined;
  readonly #retryDelayMs: number | undefined;

  constructor(options: GeminiProviderOptions = {}) {
    const apiKey = options.apiKey ?? env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required to construct GeminiProvider');
    }

    this.#apiKey = apiKey;
    this.#model = bareModelName(options.model ?? env.GEMINI_MODEL);
    this.#temperature = options.temperature ?? env.AI_TEMPERATURE;
    this.#timeoutMs = options.timeoutMs ?? env.AI_TIMEOUT_MS;
    this.#maxTokens = options.maxTokens ?? env.AI_MAX_TOKENS;
    this.#fetchImpl = options.fetchImpl;
    this.#retryDelayMs = options.retryDelayMs;
    this.name = `gemini:${this.#model}`;
  }

  async generate(request: AIRequest): Promise<unknown> {
    const payload = await postJson({
      url: `${API_BASE}/${encodeURIComponent(this.#model)}:generateContent`,
      headers: { 'x-goog-api-key': this.#apiKey },
      body: {
        // The voice and the output contract belong in the system instruction,
        // not the turn, so they are not competing with the request for the
        // model's attention.
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.user }] }],
        generationConfig: {
          temperature: this.#temperature,
          maxOutputTokens: request.maxTokens ?? this.#maxTokens,
          // Guarantees valid JSON syntax, not the right fields — the schema
          // gate remains the only thing that decides what is acceptable.
          responseMimeType: 'application/json',
        },
      },
      timeoutMs: this.#timeoutMs,
      label: `${this.name} ${request.task}`,
      secret: this.#apiKey,
      ...(this.#fetchImpl ? { fetchImpl: this.#fetchImpl } : {}),
      ...(this.#retryDelayMs === undefined ? {} : { retryDelayMs: this.#retryDelayMs }),
    });

    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`${this.name}: unexpected response envelope from the API`);
    }

    // A safety block arrives as a 200 with no candidates. Thrown rather than
    // left to the schema gate, because an identical prompt is blocked
    // identically and the retry would only cost time.
    const blockReason = parsed.data.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`${this.name}: the prompt was blocked (${blockReason})`);
    }

    const candidate = parsed.data.candidates?.[0];
    if (!candidate) {
      throw new Error(`${this.name}: the response contained no candidates`);
    }

    if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
      throw new Error(`${this.name}: generation stopped early (${candidate.finishReason})`);
    }

    if (candidate.finishReason === 'MAX_TOKENS') {
      console.error(
        `[ai] ${this.name}: ${request.task} was cut off by the token budget ` +
          `(${request.maxTokens ?? this.#maxTokens}); raise AI_MAX_TOKENS or the task's own cap`,
      );
    }

    // Long replies arrive split across several parts; concatenating them is
    // required, not defensive — taking parts[0] alone would silently truncate
    // every reading that happens to be chunked.
    const text = (candidate.content?.parts ?? []).map((part) => part.text ?? '').join('');

    return extractJsonDocument(text);
  }
}
