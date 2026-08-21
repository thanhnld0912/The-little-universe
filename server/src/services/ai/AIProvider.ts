/**
 * The boundary between "what the application needs written" and "who writes
 * it".
 *
 * The provider knows NOTHING about tarot, predictions, astronomy or personal
 * messages. It receives two blocks of text and returns whatever the model
 * produced. All domain knowledge — prompts, context assembly, output schemas —
 * belongs to the service that owns the domain.
 *
 * That keeps this interface at exactly one method. Adding a new kind of
 * reading requires no provider change at all, and implementing a new provider
 * means implementing one function rather than one per feature.
 */

export interface AIRequest {
  /**
   * A short identifier for the kind of work, e.g. 'daily' or 'weekly'.
   *
   * Real providers use this only for logging. `MockAIProvider` uses it to
   * decide which shape of plausible output to fabricate — a mock has to know
   * what it is imitating, but the INTERFACE does not, and neither does OpenAI
   * or Gemini.
   */
  task: string;

  /** Voice, rules and output contract. */
  system: string;

  /** The specific facts and question for this request. */
  user: string;

  /**
   * An opaque determinism hint.
   *
   * Real providers ignore it. The mock derives its output from it, so the same
   * date always yields the same reading — which is what lets tests assert
   * exact values and keeps local development stable across restarts.
   */
  seed?: string;

  /** Optional per-request cap; falls back to AI_MAX_TOKENS. */
  maxTokens?: number;
}

export interface AIProvider {
  /**
   * Identifies who produced a reading; stored in the `model` column so a
   * row's origin is always recoverable — including whether it came from the
   * mock.
   */
  readonly name: string;

  /**
   * Returns `unknown` ON PURPOSE.
   *
   * Model output is external data. Typing it as a finished domain object would
   * be a lie the compiler then helps spread, letting unvalidated content flow
   * onward as though it had been checked. `unknown` forces every caller
   * through `generateValidated`, so validation cannot be skipped by accident.
   */
  generate(request: AIRequest): Promise<unknown>;
}
