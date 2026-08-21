/**
 * Daily prediction caching, against the configured database.
 *
 * Every date used here is in 2030 and every row is deleted afterwards, scoped
 * to exactly those dates.
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { getDailyPrediction } from '../src/services/prediction.service.js';
import { createCountingProvider, reservedDate } from './helpers/countingProvider.js';
import { getPool, closePool } from '../src/db/pool.js';
import { queryAll, queryOne } from '../src/db/query.js';

const USED_DATES: string[] = [];

function claimDate(offset: number): string {
  const date = reservedDate(offset);
  USED_DATES.push(date);
  return date;
}

after(async () => {
  if (USED_DATES.length > 0) {
    await getPool().query('DELETE FROM daily_predictions WHERE date = ANY($1::date[])', [
      USED_DATES,
    ]);
  }
  await closePool();
});

test('a first request generates, stores and returns a complete reading', async () => {
  const date = claimDate(100);
  const provider = createCountingProvider();

  const result = await getDailyPrediction(date, provider);

  assert.equal(provider.dailyCalls, 1);
  assert.equal(result.date, date);

  // Every field the UI renders must carry a real value, not a placeholder.
  assert.ok(result.theme.length > 0);
  assert.ok(result.energy.length > 0);
  assert.ok(result.energyScore >= 0 && result.energyScore <= 100);
  assert.ok(result.luckyColor.length > 0);
  assert.match(result.luckyColorHex ?? '', /^#[0-9A-Fa-f]{6}$/);
  assert.ok(typeof result.luckyNumber === 'number');
  assert.ok(result.mood.length > 0);
  assert.ok(result.prediction.length > 0);
  assert.ok((result.cosmicQuote ?? '').length > 0);
  assert.ok((result.cosmicSign ?? '').length > 0);
  assert.ok((result.element ?? '').length > 0);
  assert.ok((result.soundFrequency ?? '').length > 0);
});

test('THE CACHE: a second request performs ZERO additional AI generations', async () => {
  const date = claimDate(101);
  const provider = createCountingProvider();

  const first = await getDailyPrediction(date, provider);
  assert.equal(provider.dailyCalls, 1, 'the first request should generate exactly once');

  const second = await getDailyPrediction(date, provider);

  // The requirement, stated exactly: still 1, not 2.
  assert.equal(provider.dailyCalls, 1, 'the second request must not call the provider');
  assert.deepEqual(second, first, 'and must return the identical stored reading');
});

test('repeated refreshes never regenerate, however many times the user reloads', async () => {
  const date = claimDate(102);
  const provider = createCountingProvider();

  const first = await getDailyPrediction(date, provider);
  for (let index = 0; index < 5; index += 1) {
    const repeat = await getDailyPrediction(date, provider);
    assert.deepEqual(repeat, first);
  }

  assert.equal(provider.dailyCalls, 1, 'six requests, one generation');

  const rows = await queryAll(getPool(), 'SELECT id FROM daily_predictions WHERE date = $1', [date]);
  assert.equal(rows.length, 1, 'and exactly one row, never a duplicate');
});

test('a fresh provider instance still reads from the database, not from memory', async () => {
  const date = claimDate(103);

  const first = createCountingProvider();
  const original = await getDailyPrediction(date, first);
  assert.equal(first.dailyCalls, 1);

  // A different provider object stands in for a different serverless instance:
  // the cache must live in Postgres, not in process memory.
  const second = createCountingProvider();
  const again = await getDailyPrediction(date, second);

  assert.equal(second.dailyCalls, 0, 'a cold instance must not regenerate an existing date');
  assert.deepEqual(again, original);
});

test('different dates each generate exactly once', async () => {
  const first = claimDate(104);
  const second = claimDate(105);
  const provider = createCountingProvider();

  await getDailyPrediction(first, provider);
  await getDailyPrediction(second, provider);
  await getDailyPrediction(first, provider);
  await getDailyPrediction(second, provider);

  assert.equal(provider.dailyCalls, 2, 'two dates, two generations, no more');
});

test('the stored row records which provider wrote it', async () => {
  const date = claimDate(106);
  await getDailyPrediction(date, createCountingProvider({ name: 'mock' }));

  const row = await queryOne<{ model: string }>(
    getPool(),
    'SELECT model FROM daily_predictions WHERE date = $1',
    [date],
  );
  assert.equal(row?.model, 'mock');
});

test('the date is stored and returned exactly, with no timezone drift', async () => {
  const date = claimDate(107);
  const result = await getDailyPrediction(date, createCountingProvider());

  assert.equal(result.date, date);

  const row = await queryOne<{ date: string }>(
    getPool(),
    'SELECT date FROM daily_predictions WHERE date = $1',
    [date],
  );
  // A `Date` here instead of a string would mean pg is converting the column
  // at local midnight, which is how a date-keyed cache misses once per day.
  assert.equal(typeof row?.date, 'string');
  assert.equal(row?.date, date);
});

test('concurrent first requests produce one row and one reading', async () => {
  const date = claimDate(108);
  const provider = createCountingProvider();

  // Simulates several cold instances racing on the first hit of a new day.
  // Both may generate; the database decides which row survives, and every
  // caller must receive that same one.
  const results = await Promise.all([
    getDailyPrediction(date, provider),
    getDailyPrediction(date, provider),
    getDailyPrediction(date, provider),
  ]);

  const rows = await queryAll(getPool(), 'SELECT id FROM daily_predictions WHERE date = $1', [date]);
  assert.equal(rows.length, 1, 'the unique constraint must permit exactly one row');

  for (const result of results) {
    assert.deepEqual(result, results[0], 'every caller sees the same reading');
  }
});

test('invalid AI output is never stored and surfaces as a controlled error', async () => {
  const date = claimDate(109);
  const provider = createCountingProvider({ daily: () => ({ theme: 'incomplete' }) });

  await assert.rejects(
    () => getDailyPrediction(date, provider),
    (error: unknown) => {
      const app = error as { code?: string; status?: number };
      assert.equal(app.code, 'UPSTREAM_ERROR');
      assert.equal(app.status, 502);
      return true;
    },
  );

  assert.equal(provider.dailyCalls, 2, 'one retry, then a controlled failure');

  const rows = await queryAll(getPool(), 'SELECT id FROM daily_predictions WHERE date = $1', [date]);
  assert.equal(rows.length, 0, 'nothing invalid may reach the database');
});

test('a provider failure surfaces as a controlled error and stores nothing', async () => {
  const date = claimDate(110);
  const provider = createCountingProvider({
    daily: () => {
      throw new Error('model host unreachable');
    },
  });

  await assert.rejects(
    () => getDailyPrediction(date, provider),
    (error: unknown) => (error as { code?: string }).code === 'UPSTREAM_ERROR',
  );

  const rows = await queryAll(getPool(), 'SELECT id FROM daily_predictions WHERE date = $1', [date]);
  assert.equal(rows.length, 0);
});

test('a failed generation leaves the date free to succeed later', async () => {
  const date = claimDate(111);

  const failing = createCountingProvider({
    daily: () => {
      throw new Error('temporary outage');
    },
  });
  await assert.rejects(() => getDailyPrediction(date, failing));

  // The earlier failure must not have poisoned the date with a partial row.
  const working = createCountingProvider();
  const result = await getDailyPrediction(date, working);
  assert.equal(result.date, date);
  assert.equal(working.dailyCalls, 1);
});

test('the astronomy snapshot is persisted with a generated reading', async () => {
  const date = claimDate(112);
  await getDailyPrediction(date, createCountingProvider());

  const row = await queryOne<{ astronomy: Record<string, unknown> | null }>(
    getPool(),
    'SELECT astronomy FROM daily_predictions WHERE date = $1',
    [date],
  );

  assert.ok(row?.astronomy, 'a generated reading must record the sky it was written from');
  const snapshot = row.astronomy;
  assert.equal(snapshot['date'], date);
  for (const field of [
    'moonPhaseAngle',
    'moonPhaseName',
    'moonIllumination',
    'sunSign',
    'moonSign',
    'nextMoonQuarter',
  ]) {
    assert.ok(snapshot[field] !== undefined, `snapshot must include ${field}`);
  }
});

test('the snapshot matches what the astronomy service computes for that date', async () => {
  const date = claimDate(113);
  await getDailyPrediction(date, createCountingProvider());

  const row = await queryOne<{ astronomy: unknown }>(
    getPool(),
    'SELECT astronomy FROM daily_predictions WHERE date = $1',
    [date],
  );
  const { buildAstronomyContext } = await import('../src/services/astronomy/index.js');
  assert.deepEqual(row?.astronomy, buildAstronomyContext(date));
});

test('the astronomy snapshot is not exposed in the API response', async () => {
  // Storing it is for reproducibility; the response contract is unchanged.
  const date = claimDate(114);
  const result = await getDailyPrediction(date, createCountingProvider());
  assert.ok(!('astronomy' in result), 'the daily DTO must not have gained a field');
});
