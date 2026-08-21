/**
 * The mock provider and the validation gate around every provider.
 *
 * Nothing here touches a network or a database, and no API key is required.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { MockAIProvider, MOCK_WEEK_SHAPE } from '../src/services/ai/MockAIProvider.js';
import {
  DAY_TYPES,
  dailyPredictionDraftSchema,
  weeklyPredictionDraftSchema,
} from '../src/services/ai/schemas.js';
import { generateValidated } from '../src/services/ai/index.js';
import type { AIProvider, AIRequest } from '../src/services/ai/AIProvider.js';
import { testRequest } from './helpers/countingProvider.js';

const provider = new MockAIProvider();
const DATE = '2026-08-21';
const WEEK_START = '2026-08-17';
const WEEK_END = '2026-08-23';

// --- the mock ---------------------------------------------------------------
test('the mock identifies itself, so a row\'s origin is recoverable', () => {
  assert.equal(provider.name, 'mock');
});

test('mock daily output satisfies the schema unmodified', async () => {
  const raw = await provider.generate(testRequest('daily', DATE));
  const parsed = dailyPredictionDraftSchema.parse(raw);

  assert.ok(parsed.energyScore >= 0 && parsed.energyScore <= 100);
  assert.match(parsed.luckyColorHex, /^#[0-9A-Fa-f]{6}$/);
  assert.ok(parsed.luckyNumber >= 0 && parsed.luckyNumber <= 99);
});

test('mock weekly output satisfies the schema unmodified', async () => {
  const raw = await provider.generate(testRequest('weekly', WEEK_START));
  const parsed = weeklyPredictionDraftSchema.parse(raw);

  assert.equal(parsed.days.length, 7);
  assert.deepEqual(
    parsed.days.map((day) => day.dayIndex).sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.equal(parsed.days.filter((day) => day.dayType === 'PEAK').length, 1);
});

test('the same date always produces the same reading', async () => {
  const first = await provider.generate(testRequest('daily', DATE));
  const second = await new MockAIProvider().generate(testRequest('daily', DATE));
  // Determinism matters twice over: a test can assert an exact value, and a
  // developer restarting the server does not get a different page.
  assert.deepEqual(first, second);
});

test('different dates produce different readings', async () => {
  const a = await provider.generate(testRequest('daily', '2026-08-21'));
  const b = await provider.generate(testRequest('daily', '2026-08-22'));
  assert.notDeepEqual(a, b);
});

test('the same week always produces the same forecast', async () => {
  const first = await provider.generate(testRequest('weekly', WEEK_START));
  const second = await provider.generate(testRequest('weekly', WEEK_START));
  assert.deepEqual(first, second);
});

test('the mock uses every declared day type exactly once', () => {
  // Guards against the mock exercising only a subset while an unused day type
  // silently fails a CHECK constraint the first time a real provider emits it.
  assert.deepEqual([...MOCK_WEEK_SHAPE].sort(), [...DAY_TYPES].sort());
});

test('mock readings suggest rather than assert', async () => {
  const raw = (await provider.generate(testRequest('daily', DATE))) as {
    prediction: string;
  };
  // The product rule: readings are for reflection and must never claim
  // certainty about the future.
  for (const forbidden of ['will definitely', 'guarantee', 'is your soulmate', 'certainly will']) {
    assert.ok(
      !raw.prediction.toLowerCase().includes(forbidden),
      `a reading must not contain "${forbidden}"`,
    );
  }
});

// --- the validation gate ----------------------------------------------------
function providerReturning(...values: unknown[]): { provider: AIProvider; calls: () => number } {
  let calls = 0;
  const queue = [...values];
  return {
    calls: () => calls,
    provider: {
      name: 'stub',
      async generate(_request: AIRequest) {
        calls += 1;
        return queue.length > 1 ? queue.shift() : queue[0];
      },
    },
  };
}

test('valid output passes through on the first attempt', async () => {
  const valid = await provider.generate(testRequest('daily', DATE));
  const stub = providerReturning(valid);

  const result = await generateValidated('test', dailyPredictionDraftSchema, () =>
    stub.provider.generate(testRequest('daily', DATE)),
  );
  assert.equal(stub.calls(), 1, 'valid output must not be retried');
  assert.equal(result.theme.length > 0, true);
});

test('invalid output is retried once, then accepted if the retry is good', async () => {
  const valid = await provider.generate(testRequest('daily', DATE));
  const stub = providerReturning({ theme: 'incomplete' }, valid);

  const result = await generateValidated('test', dailyPredictionDraftSchema, () =>
    stub.provider.generate(testRequest('daily', DATE)),
  );
  assert.equal(stub.calls(), 2);
  assert.ok(result.energy);
});

test('output that is invalid twice produces a controlled error, not a crash', async () => {
  const stub = providerReturning({ nonsense: true });
  await assert.rejects(
    () =>
      generateValidated('test', dailyPredictionDraftSchema, () =>
        stub.provider.generate(testRequest('daily', DATE)),
      ),
    (error: unknown) => {
      const app = error as { code?: string; status?: number; message?: string };
      assert.equal(app.code, 'UPSTREAM_ERROR');
      assert.equal(app.status, 502);
      // The client is told nothing about the schema or the prompt.
      assert.ok(!/(zod|schema|dayIndex|strict)/i.test(app.message ?? ''));
      return true;
    },
  );
  assert.equal(stub.calls(), 2, 'exactly two attempts, no infinite retry');
});

test('a provider that throws is not retried and yields a controlled error', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      generateValidated('test', dailyPredictionDraftSchema, async () => {
        calls += 1;
        throw new Error('ECONNRESET talking to the model host');
      }),
    (error: unknown) => {
      const app = error as { code?: string; message?: string };
      assert.equal(app.code, 'UPSTREAM_ERROR');
      // The transport failure must not reach the client verbatim.
      assert.ok(!(app.message ?? '').includes('ECONNRESET'));
      return true;
    },
  );
  assert.equal(calls, 1, 'a transport failure is not worth an identical second attempt');
});

// --- what the schemas refuse ------------------------------------------------
test('daily output with a missing field is rejected', () => {
  assert.equal(dailyPredictionDraftSchema.safeParse({ theme: 'x' }).success, false);
});

test('daily output with an extra invented field is rejected', async () => {
  const valid = (await provider.generate(testRequest('daily', DATE))) as Record<string, unknown>;

  const result = dailyPredictionDraftSchema.safeParse({ ...valid, prophecy: 'you will be rich' });
  assert.equal(result.success, false, 'a model must not be able to add arbitrary fields');
});

test('daily output with an out-of-range or wrongly-typed value is rejected', async () => {
  const valid = (await provider.generate(testRequest('daily', DATE))) as Record<string, unknown>;

  assert.equal(dailyPredictionDraftSchema.safeParse({ ...valid, energyScore: 150 }).success, false);
  assert.equal(dailyPredictionDraftSchema.safeParse({ ...valid, energyScore: 87.5 }).success, false);
  // "87" is not 87. External data is never coerced into looking correct.
  assert.equal(dailyPredictionDraftSchema.safeParse({ ...valid, energyScore: '87' }).success, false);
  assert.equal(dailyPredictionDraftSchema.safeParse({ ...valid, luckyColorHex: 'rose' }).success, false);
  assert.equal(dailyPredictionDraftSchema.safeParse({ ...valid, luckyColorHex: '#FFF' }).success, false);
  assert.equal(dailyPredictionDraftSchema.safeParse({ ...valid, prediction: '' }).success, false);
});

test('a week with the wrong number of days is rejected', async () => {
  const valid = (await provider.generate(testRequest('weekly', WEEK_START))) as { days: unknown[] };

  const six = { ...valid, days: valid.days.slice(0, 6) };
  const eight = { ...valid, days: [...valid.days, valid.days[0]] };

  assert.equal(weeklyPredictionDraftSchema.safeParse(six).success, false, 'six days');
  assert.equal(weeklyPredictionDraftSchema.safeParse(eight).success, false, 'eight days');
});

test('a week containing seven copies of one day is rejected', async () => {
  const valid = (await provider.generate(testRequest('weekly', WEEK_START))) as { days: { dayIndex: number }[] };

  // `.length(7)` alone would pass this; the permutation check is what refuses
  // it, and it is what makes the derived dates duplicate-free.
  const duplicated = { ...valid, days: Array.from({ length: 7 }, () => valid.days[0]) };
  assert.equal(weeklyPredictionDraftSchema.safeParse(duplicated).success, false);
});

test('a week with an unknown day type is rejected', async () => {
  const valid = (await provider.generate(testRequest('weekly', WEEK_START))) as { days: Record<string, unknown>[] };

  const days = valid.days.map((day, index) => (index === 0 ? { ...day, dayType: 'SPARKLY' } : day));
  assert.equal(weeklyPredictionDraftSchema.safeParse({ ...valid, days }).success, false);
});

test('a week whose brightest day disagrees with its PEAK day is rejected', async () => {
  const valid = (await provider.generate(testRequest('weekly', WEEK_START))) as Record<string, unknown>;

  // Internally inconsistent: the document names a brightest day that is not
  // the one it marked PEAK. Rejected rather than reconciled by guessing.
  const result = weeklyPredictionDraftSchema.safeParse({ ...valid, brightestDayIndex: 2 });
  assert.equal(result.success, false);
});

test('a week with no PEAK day, or more than one, is rejected', async () => {
  const valid = (await provider.generate(testRequest('weekly', WEEK_START))) as { days: Record<string, unknown>[] };

  const none = valid.days.map((day) => ({ ...day, dayType: 'QUIET' }));
  assert.equal(weeklyPredictionDraftSchema.safeParse({ ...valid, days: none }).success, false);

  const two = valid.days.map((day) => ({ ...day, dayType: 'PEAK' }));
  assert.equal(weeklyPredictionDraftSchema.safeParse({ ...valid, days: two }).success, false);
});

test('null and non-object output are rejected without throwing', () => {
  for (const value of [null, undefined, 'a string', 42, []]) {
    assert.equal(
      dailyPredictionDraftSchema.safeParse(value).success,
      false,
      `${JSON.stringify(value)} should be rejected`,
    );
  }
});
