/**
 * Per-subject readings, against the configured database.
 *
 * The requirement these tests exist for: two people asking on the same day must
 * not receive the same reading, while the same person asking twice must receive
 * exactly what they were given the first time.
 *
 * The second half matters as much as the first. "Everyone is different" is easy
 * to get by regenerating on every request, but that would mean a refresh
 * silently rewrites your day, and it would call the model on every page view.
 *
 * Every date used here is in 2030 and every row is deleted afterwards, scoped to
 * exactly those dates.
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { getDailyPrediction, getWeeklyPrediction } from '../src/services/prediction.service.js';
import { createCountingProvider, reservedDate } from './helpers/countingProvider.js';
import { closePool, getPool } from '../src/db/pool.js';
import { queryAll } from '../src/db/query.js';
import { startOfIsoWeek } from '../src/utils/dates.js';

const ALICE = 'visitor:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOB = 'visitor:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACCOUNT = 'user:cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const USED_DATES: string[] = [];
const USED_WEEKS: string[] = [];

function claimDate(offset: number): string {
  const date = reservedDate(offset);
  USED_DATES.push(date);
  return date;
}

function claimWeek(offset: number): string {
  const date = reservedDate(offset);
  USED_DATES.push(date);
  USED_WEEKS.push(startOfIsoWeek(date));
  return date;
}

after(async () => {
  const pool = getPool();
  if (USED_WEEKS.length > 0) {
    await pool.query('DELETE FROM weekly_predictions WHERE week_start = ANY($1::date[])', [
      USED_WEEKS,
    ]);
  }
  if (USED_DATES.length > 0) {
    await pool.query('DELETE FROM daily_predictions WHERE date = ANY($1::date[])', [USED_DATES]);
  }
  await closePool();
});

test('two visitors asking for the same day receive different readings', async () => {
  const date = claimDate(300);
  const provider = createCountingProvider();

  const alice = await getDailyPrediction(date, ALICE, provider);
  const bob = await getDailyPrediction(date, BOB, provider);

  assert.equal(alice.date, bob.date, 'both are readings for the same calendar day');

  // Compared as a whole rather than field by field: any single field could
  // collide by chance, but the full reading colliding would mean the subject is
  // not reaching the generator at all.
  assert.notDeepEqual(
    { ...alice, id: null },
    { ...bob, id: null },
    'two visitors must not be handed the same reading',
  );

  assert.equal(provider.dailyCalls, 2, 'each visitor is generated for exactly once');
});

test('the same visitor asking twice gets the identical reading and no second generation', async () => {
  const date = claimDate(301);
  const provider = createCountingProvider();

  const first = await getDailyPrediction(date, ALICE, provider);
  const second = await getDailyPrediction(date, ALICE, provider);

  assert.deepEqual(second, first, 'a refresh re-reads; it never rewrites the day');
  assert.equal(provider.dailyCalls, 1, 'the cached row is served without calling the model again');
});

test('a signed-in account is a different subject from an anonymous visitor', async () => {
  const date = claimDate(302);
  const provider = createCountingProvider();

  const anonymous = await getDailyPrediction(date, ALICE, provider);
  const account = await getDailyPrediction(date, ACCOUNT, provider);

  assert.notDeepEqual({ ...anonymous, id: null }, { ...account, id: null });
  assert.equal(provider.dailyCalls, 2);
});

test('the astronomy is identical for every subject on the same day', async () => {
  const date = claimDate(303);
  const provider = createCountingProvider();

  await getDailyPrediction(date, ALICE, provider);
  await getDailyPrediction(date, BOB, provider);

  const rows = await queryAll<{ subject_id: string; astronomy: Record<string, unknown> }>(
    getPool(),
    'SELECT subject_id, astronomy FROM daily_predictions WHERE date = $1 ORDER BY subject_id',
    [date],
  );

  assert.equal(rows.length, 2);
  const [first, second] = rows;
  assert.ok(first && second);

  // The moon phase on a given day is a fact about the sky, not about the
  // reader. Personalising the interpretation must never personalise the facts.
  assert.deepEqual(
    first.astronomy,
    second.astronomy,
    'the sky must not differ between two people on the same day',
  );
});

test('two visitors receive different weekly forecasts for the same week', async () => {
  const date = claimWeek(310);
  const provider = createCountingProvider();

  const alice = await getWeeklyPrediction(date, ALICE, provider);
  const bob = await getWeeklyPrediction(date, BOB, provider);

  assert.equal(alice.weekStart, bob.weekStart);
  assert.equal(alice.days.length, 7);
  assert.equal(bob.days.length, 7, 'the exactly-seven-days invariant survives per-subject keying');

  assert.notEqual(
    alice.days.map((day) => day.prediction).join('|'),
    bob.days.map((day) => day.prediction).join('|'),
    'two visitors must not be handed the same week',
  );

  assert.equal(provider.weeklyCalls, 2);
});

test('the same visitor asking twice for a week gets the identical forecast', async () => {
  const date = claimWeek(317);
  const provider = createCountingProvider();

  const first = await getWeeklyPrediction(date, ALICE, provider);
  const second = await getWeeklyPrediction(date, ALICE, provider);

  assert.deepEqual(second, first);
  assert.equal(provider.weeklyCalls, 1);
});

test('the database refuses a subject id it did not issue', async () => {
  const date = claimDate(330);
  const provider = createCountingProvider();

  // The CHECK constraint is the last line of defence: even if a caller found a
  // way past `resolveSubject`, a fabricated subject cannot become a storage key.
  await assert.rejects(
    () => getDailyPrediction(date, 'visitor:not-a-uuid', provider),
    /violates check constraint|check constraint/i,
  );

  const rows = await queryAll(getPool(), 'SELECT id FROM daily_predictions WHERE date = $1', [date]);
  assert.equal(rows.length, 0, 'nothing is stored for a rejected subject');
});
