/**
 * A provider wrapper that counts generations.
 *
 * The caching requirement is not "the second response looks the same" — it is
 * "the second request performs ZERO additional AI generations". Only a counter
 * can prove that. Two identical responses would also be produced by a service
 * that regenerates deterministic mock content every time, which is exactly the
 * kind of test that passes for the wrong reason.
 *
 * Counting is keyed on `request.task`, the same field a real provider would use
 * only for logging.
 */
import type { AIProvider, AIRequest } from '../../src/services/ai/AIProvider.js';
import { MockAIProvider } from '../../src/services/ai/MockAIProvider.js';

export interface CountingProvider extends AIProvider {
  dailyCalls: number;
  weeklyCalls: number;
  tarotCalls: number;
  totalCalls: () => number;
}

/**
 * Wraps the real mock so the content is genuine and schema-valid; only the
 * call accounting is added.
 *
 * `override` lets a test substitute deliberately broken output to exercise the
 * rejection paths.
 */
export function createCountingProvider(override?: {
  daily?: () => unknown;
  weekly?: () => unknown;
  tarot?: () => unknown;
  name?: string;
}): CountingProvider {
  const inner = new MockAIProvider();

  return {
    name: override?.name ?? 'mock',
    dailyCalls: 0,
    weeklyCalls: 0,
    tarotCalls: 0,
    totalCalls(): number {
      return this.dailyCalls + this.weeklyCalls + this.tarotCalls;
    },
    async generate(request: AIRequest): Promise<unknown> {
      switch (request.task) {
        case 'daily':
          this.dailyCalls += 1;
          return override?.daily ? override.daily() : inner.generate(request);
        case 'weekly':
          this.weeklyCalls += 1;
          return override?.weekly ? override.weekly() : inner.generate(request);
        case 'tarot':
          this.tarotCalls += 1;
          return override?.tarot ? override.tarot() : inner.generate(request);
        default:
          throw new Error(`Unexpected task in test: ${request.task}`);
      }
    },
  };
}

/** Builds a minimal request for tests that exercise a provider directly. */
export function testRequest(task: string, seed: string): AIRequest {
  return { task, system: 'test-system', user: 'test-user', seed };
}

/**
 * A date no real usage will touch, for tests that call the SERVICE directly.
 *
 * 2030 is far outside anything a user would request, so these rows cannot
 * collide with a genuine prediction. It is deliberately outside the API's
 * accepted date window too — service-level tests do not go through request
 * validation, and using an unreachable date makes that separation obvious.
 */
export function reservedDate(offsetDays: number): string {
  const base = Date.UTC(2030, 0, 7); // a Monday
  return new Date(base + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A date for tests that go through the HTTP ROUTE, which enforces the
 * `?date=` window.
 *
 * Anchored to the current date so it stays inside that window however long
 * from now the suite is run, and far enough ahead (about ten months) that it
 * will not collide with a prediction anyone is actually reading. Rows are
 * still deleted afterwards.
 *
 * The window is a cost control — it stops a script walking arbitrary dates and
 * minting unlimited AI generations that all miss the cache — so the tests bend
 * to it rather than the other way round.
 */
export function reservedRouteDate(offsetDays: number): string {
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return new Date(today + (300 + offsetDays) * 86_400_000).toISOString().slice(0, 10);
}
