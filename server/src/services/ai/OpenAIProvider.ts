/**
 * OpenAI, over the Chat Completions API.
 *
 * Like every provider, this file knows nothing about tarot, predictions or
 * messages. It receives two blocks of finished text and returns whatever the
 * model produced, unvalidated — `generateValidated` is the only thing allowed
 * to turn model output into a trusted object.
 *
 * WHY THIS IS WHAT MAKES READINGS UNIQUE. `MockAIProvider` picks from fixed
 * lists, so two people eventually draw the same title. A real model writing at
 * a non-zero temperature produces genuinely different prose for the same
 * prompt, which is what the per-subject rows and per-subject cache keys were
 * built to hold. `seed` is therefore deliberately IGNORED here: it exists to
 * make the mock reproducible, and honouring it as OpenAI's `seed` parameter
 * would push the real provider back toward the sameness this replaced.
 * Repeat-request stability comes from the database, not from the model.
 */
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { AIProvider, AIRequest } from './AIProvider.js';
import { extractJsonDocument, postJson, type FetchLike } from './http.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export interface OpenAIProviderOptions {
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
 * Only the fields that are read. Unknown keys are stripped rather than
 * rejected: this is OpenAI's envelope, not model output, and the vendor adds
 * fields to it over time. The CONTENT inside it is still strictly validated
 * downstream, which is where strictness earns its keep.
 */
const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          refusal: z.string().nullable().optional(),
        }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1, 'the response contained no choices'),
});

export class OpenAIProvider implements AIProvider {
  /**
   * Carries the model, not just the vendor, because it is stored in the
   * `model` column. "openai" alone would leave a row's origin ambiguous the
   * first time the configured model changes.
   */
  readonly name: string;

  readonly #apiKey: string;
  readonly #model: string;
  readonly #temperature: number;
  readonly #timeoutMs: number;
  readonly #maxTokens: number;
  readonly #fetchImpl: FetchLike | undefined;
  readonly #retryDelayMs: number | undefined;

  constructor(options: OpenAIProviderOptions = {}) {
    const apiKey = options.apiKey ?? env.OPENAI_API_KEY;
    if (!apiKey) {
      // `env.ts` already refuses to boot with AI_PROVIDER=openai and no key.
      // This is the second lock: constructing the provider directly, as a test
      // or a script might, must not silently produce one that cannot work.
      throw new Error('OPENAI_API_KEY is required to construct OpenAIProvider');
    }

    this.#apiKey = apiKey;
    this.#model = options.model ?? env.OPENAI_MODEL;
    this.#temperature = options.temperature ?? env.AI_TEMPERATURE;
    this.#timeoutMs = options.timeoutMs ?? env.AI_TIMEOUT_MS;
    this.#maxTokens = options.maxTokens ?? env.AI_MAX_TOKENS;
    this.#fetchImpl = options.fetchImpl;
    this.#retryDelayMs = options.retryDelayMs;
    this.name = `openai:${this.#model}`;
  }

  async generate(request: AIRequest): Promise<unknown> {
    const payload = await postJson({
      url: ENDPOINT,
      headers: { Authorization: `Bearer ${this.#apiKey}` },
      body: {
        model: this.#model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        // Guarantees a syntactically valid JSON object. It does NOT guarantee
        // the right fields, which is why the schema gate still exists.
        response_format: { type: 'json_object' },
        temperature: this.#temperature,
        // `max_tokens` is deprecated in favour of this on current models.
        max_completion_tokens: request.maxTokens ?? this.#maxTokens,
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

    const choice = parsed.data.choices[0];
    if (!choice) throw new Error(`${this.name}: the response contained no choices`);

    // A refusal is the model declining, not failing. Retrying the identical
    // prompt would be refused identically, so it is thrown rather than left to
    // the schema gate's retry.
    if (choice.message.refusal) {
      throw new Error(`${this.name}: the model declined to answer for task ${request.task}`);
    }

    if (choice.finish_reason === 'length') {
      // Named explicitly because the symptom — truncated, unparseable JSON —
      // otherwise sends a reader hunting through the prompt when the actual
      // fix is the token budget.
      console.error(
        `[ai] ${this.name}: ${request.task} was cut off by the token budget ` +
          `(${request.maxTokens ?? this.#maxTokens}); raise AI_MAX_TOKENS or the task's own cap`,
      );
    }

    return extractJsonDocument(choice.message.content ?? '');
  }
}
