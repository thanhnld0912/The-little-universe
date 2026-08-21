/**
 * The prediction endpoints through the whole middleware chain.
 *
 * These use the real configured provider (`AI_PROVIDER=mock`), so they also
 * confirm the default configuration serves readings with no API key present.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startTestServer, type TestServer } from './helpers/testServer.js';
import { reservedRouteDate } from './helpers/countingProvider.js';
import { startOfIsoWeek } from '../src/utils/dates.js';

let api: TestServer;
const USED_DATES: string[] = [];
const USED_WEEKS: string[] = [];

function claimDate(offset: number): string {
  const date = reservedRouteDate(offset);
  USED_DATES.push(date);
  USED_WEEKS.push(startOfIsoWeek(date));
  return date;
}

before(async () => {
  api = await startTestServer();
});

after(async () => {
  const { getPool, closePool } = await import('../src/db/pool.js');
  const pool = getPool();
  if (USED_DATES.length > 0) {
    await pool.query('DELETE FROM daily_predictions WHERE date = ANY($1::date[])', [USED_DATES]);
  }
  if (USED_WEEKS.length > 0) {
    await pool.query('DELETE FROM weekly_predictions WHERE week_start = ANY($1::date[])', [
      USED_WEEKS,
    ]);
  }
  await closePool();
  await api.close();
});

// --- daily ------------------------------------------------------------------
test('GET /api/predictions/daily returns the standard envelope', async () => {
  const date = claimDate(1);
  const response = await api.request('GET', `/api/predictions/daily?date=${date}`);

  assert.equal(response.status, 200, response.raw);
  assert.equal(response.body.success, true);

  const data = response.body.data as Record<string, unknown>;
  assert.equal(data['date'], date);
  for (const field of [
    'theme',
    'energy',
    'energyScore',
    'luckyColor',
    'luckyColorHex',
    'luckyNumber',
    'mood',
    'prediction',
    'cosmicQuote',
    'cosmicSign',
    'element',
    'soundFrequency',
  ]) {
    assert.ok(data[field] !== undefined && data[field] !== null, `${field} must carry a value`);
  }
});

test('GET /api/predictions/daily works with no date parameter', async () => {
  // Today's reading. Not cleaned up: it is a legitimate row for a real date,
  // and deleting it would remove a prediction a user may already have seen.
  const response = await api.request('GET', '/api/predictions/daily');
  assert.equal(response.status, 200, response.raw);
  assert.match((response.body.data as { date: string }).date, /^\d{4}-\d{2}-\d{2}$/);
});

test('the same date returns a byte-identical reading on every request', async () => {
  const date = claimDate(2);
  const first = await api.request('GET', `/api/predictions/daily?date=${date}`);
  const second = await api.request('GET', `/api/predictions/daily?date=${date}`);
  const third = await api.request('GET', `/api/predictions/daily?date=${date}`);

  assert.equal(first.status, 200, first.raw);
  // What the refresh button does: re-fetch, never regenerate.
  assert.equal(second.raw, first.raw);
  assert.equal(third.raw, first.raw);
});

test('a malformed date is refused with a validation error', async () => {
  for (const value of ['nonsense', '2026-13-01', '2026-02-30', '21-08-2026', '2026/08/21']) {
    const response = await api.request(
      'GET',
      `/api/predictions/daily?date=${encodeURIComponent(value)}`,
    );
    assert.equal(response.status, 400, `${value}: ${response.raw}`);
    assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
  }
});

test('a date far outside the allowed window is refused', async () => {
  // Otherwise a script could walk arbitrary dates and mint unlimited AI calls,
  // every one of which would miss the cache.
  const response = await api.request('GET', '/api/predictions/daily?date=9999-12-31');
  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

test('the daily endpoint needs no account', async () => {
  const date = claimDate(3);
  const response = await api.request('GET', `/api/predictions/daily?date=${date}`);
  assert.equal(response.status, 200, response.raw);
});

test('a present but invalid token is refused rather than ignored', async () => {
  const response = await api.request('GET', '/api/predictions/daily', { token: 'a.b.c' });
  assert.equal(response.status, 401, response.raw);
  assert.equal(response.body.error?.code, 'UNAUTHORIZED');
});

// --- weekly -----------------------------------------------------------------
test('GET /api/predictions/weekly returns seven consecutive days', async () => {
  const date = claimDate(10);
  const response = await api.request('GET', `/api/predictions/weekly?date=${date}`);

  assert.equal(response.status, 200, response.raw);
  const data = response.body.data as {
    weekStart: string;
    weekEnd: string;
    summary: string;
    brightestDay: string;
    days: { date: string; day: string; type: string; score: number }[];
  };

  assert.equal(data.days.length, 7);
  assert.equal(new Set(data.days.map((day) => day.date)).size, 7);
  assert.equal(data.days[0]?.date, data.weekStart);
  assert.equal(data.days[6]?.date, data.weekEnd);
  assert.deepEqual(
    data.days.map((day) => day.day),
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  );
  assert.ok(data.summary.length > 0);
  assert.ok(data.brightestDay.length > 0);
});

test('every day type the API returns is one the frontend can render', async () => {
  const date = claimDate(11);
  const response = await api.request('GET', `/api/predictions/weekly?date=${date}`);
  const data = response.body.data as { days: { type: string }[] };

  // ThisWeekView switches on these exact strings to choose an icon and falls
  // through to a generic one for anything else.
  const renderable = new Set(['QUIET', 'FLOW', 'PIVOT', 'CLARITY', 'PEAK', 'REST', 'REFLECT']);
  for (const day of data.days) {
    assert.ok(renderable.has(day.type), `unrenderable day type: ${day.type}`);
  }
});

test('GET /api/predictions/weekly works with no date parameter', async () => {
  const response = await api.request('GET', '/api/predictions/weekly');
  assert.equal(response.status, 200, response.raw);
  const data = response.body.data as { days: unknown[] };
  assert.equal(data.days.length, 7);
});

test('the same week returns a byte-identical forecast on every request', async () => {
  const date = claimDate(12);
  const first = await api.request('GET', `/api/predictions/weekly?date=${date}`);
  const second = await api.request('GET', `/api/predictions/weekly?date=${date}`);

  assert.equal(first.status, 200, first.raw);
  assert.equal(second.raw, first.raw);
});

test('a malformed date is refused on the weekly endpoint too', async () => {
  const response = await api.request('GET', '/api/predictions/weekly?date=not-a-date');
  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

// --- leakage ----------------------------------------------------------------
test('no prediction response exposes internals', async () => {
  const date = claimDate(20);
  const responses = [
    await api.request('GET', `/api/predictions/daily?date=${date}`),
    await api.request('GET', `/api/predictions/weekly?date=${date}`),
    await api.request('GET', '/api/predictions/daily?date=bad'),
  ];

  for (const response of responses) {
    const raw = response.raw.toLowerCase();
    for (const leak of [
      'postgres',
      'neon',
      'sslmode',
      'password',
      'jwt_secret',
      'database_url',
      'select ',
      'insert into',
      'sqlstate',
      'stack',
      'weekly_prediction_id',
    ]) {
      assert.ok(!raw.includes(leak), `response must not contain "${leak}"`);
    }
  }
});
