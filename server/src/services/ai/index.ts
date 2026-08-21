/**
 * Provider selection and the one place unvalidated model output is turned into
 * a trusted domain object.
 */
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import type { AIProvider } from './AIProvider.js';
import { MockAIProvider } from './MockAIProvider.js';

let cached: AIProvider | undefined;

/**
 * Resolves the configured provider.
 *
 * `env.ts` has already refused to boot if a provider was selected without its
 * credentials, so the only failure reachable here is a provider that has not
 * been built yet. It throws rather than quietly falling back to the mock:
 * a deployment that believes it is calling OpenAI and is actually serving
 * canned text is a far worse outcome than a loud startup failure.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  switch (env.AI_PROVIDER) {
    case 'mock':
      cached = new MockAIProvider();
      return cached;
    case 'openai':
    case 'gemini':
      throw new Error(
        `AI_PROVIDER=${env.AI_PROVIDER} is not implemented yet (arriving in Phase 6). ` +
          `Set AI_PROVIDER=mock to run without an API key.`,
      );
    default: {
      // Unreachable while the env enum holds, but fails closed if it changes.
      const exhaustive: never = env.AI_PROVIDER;
      throw new Error(`Unsupported AI_PROVIDER: ${String(exhaustive)}`);
    }
  }
}

/** Test seam: forget the memoised provider. */
export function resetAIProvider(): void {
  cached = undefined;
}

/**
 * Calls a provider and validates what comes back, retrying ONCE on a schema
 * failure.
 *
 * The retry is safe specifically because generation writes nothing: a rejected
 * draft is discarded in memory and the second attempt starts from the same
 * clean state. Nothing reaches the database until a draft has passed
 * validation, so there is no partial write to undo and no risk of storing the
 * invalid document — which is the requirement that matters.
 *
 * A model that fails twice produces a controlled 502. The Zod issues are
 * logged server-side for diagnosis and deliberately NOT returned to the
 * client, which has no use for them and should not learn about our prompt.
 */
export async function generateValidated<T>(
  label: string,
  schema: ZodType<T>,
  call: () => Promise<unknown>,
): Promise<T> {
  let lastError: ZodError | undefined;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let raw: unknown;
    try {
      raw = await call();
    } catch (error) {
      // A transport or provider failure is not a validation problem and is not
      // worth a second identical attempt.
      console.error(`[ai] ${label}: provider call failed:`, error);
      throw AppError.upstream('The stars are quiet right now. Please try again in a moment.');
    }

    const result = schema.safeParse(raw);
    if (result.success) return result.data;

    lastError = result.error;
    console.error(
      `[ai] ${label}: attempt ${attempt} produced invalid output:`,
      result.error.issues.map((issue) => `${issue.path.join('.') || '_'}: ${issue.message}`),
    );
  }

  console.error(`[ai] ${label}: giving up after 2 attempts`, lastError?.issues.length ?? 0, 'issues');
  throw AppError.upstream('The stars are quiet right now. Please try again in a moment.');
}

export type { AIProvider } from './AIProvider.js';
