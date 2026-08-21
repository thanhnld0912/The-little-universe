/**
 * Weekly forecast caching and the exactly-seven-days invariant.
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import {
  assertWholeWeek,
  getWeeklyPrediction,
  type WeeklyPredictionDto,
} from '../src/services/prediction.service.js';
import { createCountingProvider, reservedDate } from './helpers/countingProvider.js';
import { getPool, closePool } from '../src/db/pool.js';
import { queryAll, queryOne } from '../src/db/query.js';
import { addDays, daysBetween, startOfIsoWeek } from '../src/utils/dates.js';
import { MockAIProvider } from '../src/services/ai/MockAIProvider.js';

const USED_WEEKS: string[] = [];

/** `offsetWeeks` is in whole weeks from a known Monday, so weeks never overlap. */
function claimWeek(offsetWeeks: number): string {
  const date = reservedDate(140 + offsetWeeks * 7);
  USED_WEEKS.push(startOfIsoWeek(date));
  return date;
}

after(async () => {
  if (USED_WEEKS.length > 0) {
    // Day rows cascade from the parent.
    await getPool().query('DELETE FROM weekly_predictions WHERE week_start = ANY($1::date[])', [
      USED_WEEKS,
    ]);
  }
  await closePool();
});

/** The full invariant, asserted on a response. */
function assertSevenConsecutiveDays(week: WeeklyPredictionDto): void {
  assert.equal(week.days.length, 7, 'exactly seven days');

  const dates = week.days.map((day) => day.date);
  assert.equal(new Set(dates).size, 7, 'no duplicate dates');

  for (let index = 1; index < dates.length; index += 1) {
    assert.equal(
      daysBetween(dates[index - 1] as string, dates[index] as string),
      1,
      `day ${index} must follow day ${index - 1} with no gap`,
    );
  }

  assert.equal(dates[0], week.weekStart, 'the first day is weekStart');
  assert.equal(dates[6], week.weekEnd, 'the last day is weekEnd');
  assert.equal(daysBetween(week.weekStart, week.weekEnd), 6, 'the week spans six days');
  assert.deepEqual(
    week.days.map((day) => day.day),
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    'Monday first, Sunday last',
  );
}

test('a first request generates a complete, well-formed week', async () => {
  const provider = createCountingProvider();
  const week = await getWeeklyPrediction(claimWeek(0), provider);

  assert.equal(provider.weeklyCalls, 1);
  assertSevenConsecutiveDays(week);

  assert.ok(week.summary.length > 0);
  assert.ok(week.brightestDay.length > 0);

  for (const day of week.days) {
    assert.ok(day.id.length > 0, 'each day carries an id for use as a render key');
    assert.ok(day.tagline.length > 0);
    assert.ok(day.prediction.length > 0);
    assert.ok(day.score >= 0 && day.score <= 100);
    assert.ok(day.shortName.length === 3);
    assert.ok((day.element ?? '').length > 0);
    assert.ok((day.gemstone ?? '').length > 0);
  }
});

test('THE CACHE: a second request performs ZERO additional AI generations', async () => {
  const date = claimWeek(1);
  const provider = createCountingProvider();

  const first = await getWeeklyPrediction(date, provider);
  assert.equal(provider.weeklyCalls, 1);

  const second = await getWeeklyPrediction(date, provider);

  assert.equal(provider.weeklyCalls, 1, 'the second request must not call the provider');
  assert.deepEqual(second, first);
});

test('any day of the week resolves to the same cached forecast', async () => {
  const monday = startOfIsoWeek(claimWeek(2));
  const provider = createCountingProvider();

  const fromMonday = await getWeeklyPrediction(monday, provider);

  // Requesting by Wednesday, Friday or Sunday must not create a second week.
  for (const offset of [2, 4, 6]) {
    const result = await getWeeklyPrediction(addDays(monday, offset), provider);
    assert.deepEqual(result, fromMonday);
  }

  assert.equal(provider.weeklyCalls, 1, 'four requests across one week, one generation');

  const rows = await queryAll(getPool(), 'SELECT id FROM weekly_predictions WHERE week_start = $1', [
    monday,
  ]);
  assert.equal(rows.length, 1);
});

test('exactly seven day rows are persisted', async () => {
  const date = claimWeek(3);
  const week = await getWeeklyPrediction(date, createCountingProvider());

  const rows = await queryAll<{ day_date: string }>(
    getPool(),
    `SELECT d.day_date FROM weekly_prediction_days d
       JOIN weekly_predictions w ON w.id = d.weekly_prediction_id
      WHERE w.week_start = $1
      ORDER BY d.day_date`,
    [week.weekStart],
  );

  assert.equal(rows.length, 7);
  assert.deepEqual(
    rows.map((row) => row.day_date),
    week.days.map((day) => day.date),
  );
});

test('exactly one day is marked as the peak, and it matches brightestDay', async () => {
  const week = await getWeeklyPrediction(claimWeek(4), createCountingProvider());

  const peaks = week.days.filter((day) => day.isPeak);
  assert.equal(peaks.length, 1, 'exactly one peak day');
  assert.equal(peaks[0]?.day, week.brightestDay, 'the peak day is the brightest day');
  assert.equal(peaks[0]?.type, 'PEAK');
});

test('the highlight appears only on the peak day', async () => {
  const week = await getWeeklyPrediction(claimWeek(5), createCountingProvider());

  for (const day of week.days) {
    if (day.isPeak) {
      assert.ok(day.highlightTitle, 'the peak day carries a highlight title');
      assert.ok(day.highlightQuote, 'the peak day carries a highlight quote');
    } else {
      // Lumiere lesson section 7: absent means the key is ABSENT. An empty
      // string is truthy on the client and would render a blank heading.
      assert.ok(!('highlightTitle' in day), 'a non-peak day must omit the key entirely');
      assert.ok(!('highlightQuote' in day), 'a non-peak day must omit the key entirely');
    }
  }
});

test('ungenerated columns are omitted, not sent as empty values', async () => {
  const week = await getWeeklyPrediction(claimWeek(6), createCountingProvider());

  for (const day of week.days) {
    // Nothing generates `energy` or `mood` because the UI renders neither.
    // They must not appear as "" or null and look like real, blank content.
    assert.ok(!('energy' in day), 'energy must be omitted, not empty');
    assert.ok(!('mood' in day), 'mood must be omitted, not empty');
  }
});

test('a fresh provider instance reads the stored week rather than regenerating', async () => {
  const date = claimWeek(7);
  const original = await getWeeklyPrediction(date, createCountingProvider());

  const cold = createCountingProvider();
  const again = await getWeeklyPrediction(date, cold);

  assert.equal(cold.weeklyCalls, 0);
  assert.deepEqual(again, original);
});

test('concurrent first requests produce one week and seven days', async () => {
  const date = claimWeek(8);
  const provider = createCountingProvider();

  const results = await Promise.all([
    getWeeklyPrediction(date, provider),
    getWeeklyPrediction(date, provider),
    getWeeklyPrediction(date, provider),
  ]);

  const weekStart = startOfIsoWeek(date);
  const weeks = await queryAll(getPool(), 'SELECT id FROM weekly_predictions WHERE week_start = $1', [
    weekStart,
  ]);
  assert.equal(weeks.length, 1, 'one week row');

  const days = await queryOne<{ c: string }>(
    getPool(),
    `SELECT count(*)::text AS c FROM weekly_prediction_days d
       JOIN weekly_predictions w ON w.id = d.weekly_prediction_id
      WHERE w.week_start = $1`,
    [weekStart],
  );
  // The parent and its seven days commit together, so a losing writer can
  // never observe or create a partial week.
  assert.equal(days?.c, '7', 'exactly seven day rows, never fourteen and never partial');

  for (const result of results) {
    assertSevenConsecutiveDays(result);
    assert.deepEqual(result, results[0]);
  }
});

// --- rejection of malformed weekly output -----------------------------------
async function validWeeklyDraft(weekStart: string): Promise<Record<string, unknown>> {
  return (await new MockAIProvider().generate({
    task: 'weekly',
    system: 'test',
    user: 'test',
    seed: weekStart,
  })) as Record<string, unknown>;
}

test('a six-day week is rejected and never padded', async () => {
  const date = claimWeek(9);
  const weekStart = startOfIsoWeek(date);
  const draft = await validWeeklyDraft(weekStart);
  const provider = createCountingProvider({
    weekly: () => ({ ...draft, days: (draft['days'] as unknown[]).slice(0, 6) }),
  });

  await assert.rejects(
    () => getWeeklyPrediction(date, provider),
    (error: unknown) => (error as { code?: string }).code === 'UPSTREAM_ERROR',
  );

  const rows = await queryAll(getPool(), 'SELECT id FROM weekly_predictions WHERE week_start = $1', [
    weekStart,
  ]);
  assert.equal(rows.length, 0, 'nothing is stored, and no day is invented to reach seven');
});

test('an eight-day week is rejected and never truncated', async () => {
  const date = claimWeek(10);
  const weekStart = startOfIsoWeek(date);
  const draft = await validWeeklyDraft(weekStart);
  const days = draft['days'] as unknown[];
  const provider = createCountingProvider({
    weekly: () => ({ ...draft, days: [...days, days[0]] }),
  });

  await assert.rejects(
    () => getWeeklyPrediction(date, provider),
    (error: unknown) => (error as { code?: string }).code === 'UPSTREAM_ERROR',
  );

  const rows = await queryAll(getPool(), 'SELECT id FROM weekly_predictions WHERE week_start = $1', [
    weekStart,
  ]);
  assert.equal(rows.length, 0, 'nothing is stored, and the eighth day is not silently dropped');
});

test('a week with duplicate days is rejected', async () => {
  const date = claimWeek(11);
  const weekStart = startOfIsoWeek(date);
  const draft = await validWeeklyDraft(weekStart);
  const days = draft['days'] as unknown[];
  const provider = createCountingProvider({
    weekly: () => ({ ...draft, days: Array.from({ length: 7 }, () => days[0]) }),
  });

  await assert.rejects(
    () => getWeeklyPrediction(date, provider),
    (error: unknown) => (error as { code?: string }).code === 'UPSTREAM_ERROR',
  );

  const rows = await queryAll(getPool(), 'SELECT id FROM weekly_predictions WHERE week_start = $1', [
    weekStart,
  ]);
  assert.equal(rows.length, 0);
});

test('a provider failure stores nothing and leaves the week free to retry', async () => {
  const date = claimWeek(12);
  const weekStart = startOfIsoWeek(date);

  const failing = createCountingProvider({
    weekly: () => {
      throw new Error('model host unreachable');
    },
  });
  await assert.rejects(
    () => getWeeklyPrediction(date, failing),
    (error: unknown) => (error as { code?: string }).code === 'UPSTREAM_ERROR',
  );

  const empty = await queryAll(getPool(), 'SELECT id FROM weekly_predictions WHERE week_start = $1', [
    weekStart,
  ]);
  assert.equal(empty.length, 0);

  const working = createCountingProvider();
  const week = await getWeeklyPrediction(date, working);
  assertSevenConsecutiveDays(week);
});

// --- the invariant helper, directly ------------------------------------------
test('assertWholeWeek accepts a correct week', () => {
  assert.doesNotThrow(() =>
    assertWholeWeek('2026-08-17', '2026-08-23', [
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]),
  );
});

test('assertWholeWeek rejects every way a week can be wrong', () => {
  const full = [
    '2026-08-17',
    '2026-08-18',
    '2026-08-19',
    '2026-08-20',
    '2026-08-21',
    '2026-08-22',
    '2026-08-23',
  ];

  // too few
  assert.throws(() => assertWholeWeek('2026-08-17', '2026-08-23', full.slice(0, 6)));
  // too many
  assert.throws(() => assertWholeWeek('2026-08-17', '2026-08-23', [...full, '2026-08-24']));
  // duplicate
  assert.throws(() =>
    assertWholeWeek('2026-08-17', '2026-08-23', [...full.slice(0, 6), '2026-08-22']),
  );
  // a gap
  assert.throws(() =>
    assertWholeWeek('2026-08-17', '2026-08-23', [...full.slice(0, 6), '2026-08-24']),
  );
  // belongs to a different week
  assert.throws(() =>
    assertWholeWeek('2026-08-17', '2026-08-23', full.map((date) => addDays(date, 7))),
  );
  // weekEnd inconsistent with weekStart
  assert.throws(() => assertWholeWeek('2026-08-17', '2026-08-22', full));
});
