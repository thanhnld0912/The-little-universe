/**
 * Application timezone semantics.
 *
 * The product is aimed at readers in Vietnam, so the application day rolls over
 * at midnight Asia/Ho_Chi_Minh — 17:00 UTC the previous day. Under the previous
 * UTC-midnight rule a reader opening the app at 9pm local was already shown the
 * NEXT day's reading, which is the bug these tests exist to prevent returning.
 *
 * Every test passes the zone explicitly, so results do not depend on the host
 * machine's timezone or on what APP_TIMEZONE happens to be set to.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  currentAppDate,
  endOfIsoWeek,
  startOfIsoWeek,
  toZonedDate,
  zoneOffsetMinutes,
  zonedNoonInstant,
} from '../src/utils/dates.js';
import { env } from '../src/config/env.js';

const VN = 'Asia/Ho_Chi_Minh';

// --- the boundary -------------------------------------------------------------
test('the day rolls over at 17:00 UTC, not at UTC midnight', () => {
  assert.equal(
    toZonedDate(new Date('2026-08-21T16:59:59Z'), VN),
    '2026-08-21',
    'one second before local midnight it is still the 21st',
  );
  assert.equal(
    toZonedDate(new Date('2026-08-21T17:00:00Z'), VN),
    '2026-08-22',
    'at exactly local midnight it becomes the 22nd',
  );
});

test('the seven hours between local and UTC midnight resolve to the local day', () => {
  // This window is the whole point: under the old rule every instant here
  // reported the following day.
  for (const time of ['17:00:00', '18:30:00', '21:00:00', '23:59:59']) {
    assert.equal(
      toZonedDate(new Date(`2026-08-21T${time}Z`), VN),
      '2026-08-22',
      `${time}Z is already the 22nd in Vietnam`,
    );
  }
});

test('UTC midnight itself is mid-morning of the same local day', () => {
  assert.equal(toZonedDate(new Date('2026-08-22T00:00:00Z'), VN), '2026-08-22');
  assert.equal(toZonedDate(new Date('2026-08-22T10:00:00Z'), VN), '2026-08-22');
});

test('the year boundary follows local time', () => {
  assert.equal(toZonedDate(new Date('2025-12-31T16:59:59Z'), VN), '2025-12-31');
  assert.equal(
    toZonedDate(new Date('2025-12-31T17:00:00Z'), VN),
    '2026-01-01',
    'the new year arrives seven hours before it does in UTC',
  );
  assert.equal(toZonedDate(new Date('2026-01-01T00:00:00Z'), VN), '2026-01-01');
});

test('month and leap-day boundaries follow local time', () => {
  assert.equal(toZonedDate(new Date('2026-08-31T17:00:00Z'), VN), '2026-09-01');
  assert.equal(toZonedDate(new Date('2024-02-28T17:00:00Z'), VN), '2024-02-29');
  assert.equal(toZonedDate(new Date('2024-02-29T17:00:00Z'), VN), '2024-03-01');
});

test('UTC and Vietnam genuinely disagree in that window', () => {
  // Guards against the zone being silently ignored: if `toZonedDate` fell back
  // to UTC, these two would match and the test would fail.
  const instant = new Date('2026-08-21T20:00:00Z');
  assert.equal(toZonedDate(instant, 'UTC'), '2026-08-21');
  assert.equal(toZonedDate(instant, VN), '2026-08-22');
});

// --- offsets ------------------------------------------------------------------
test('Vietnam is a fixed +07:00 with no daylight saving', () => {
  // Checked across all four quarters: if the zone ever gained DST, or if the
  // offset were hard-coded incorrectly, this fails.
  for (const month of ['01', '04', '07', '10']) {
    assert.equal(
      zoneOffsetMinutes(new Date(`2026-${month}-15T12:00:00Z`), VN),
      420,
      `offset in month ${month}`,
    );
  }
});

test('offsets are read from the timezone database, not assumed', () => {
  assert.equal(zoneOffsetMinutes(new Date('2026-08-21T12:00:00Z'), 'UTC'), 0);
  // A zone that DOES observe DST must report two different offsets, proving
  // the value comes from the tz database rather than a constant.
  const january = zoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'America/New_York');
  const july = zoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'America/New_York');
  assert.equal(january, -300);
  assert.equal(july, -240);
  assert.notEqual(january, july);
});

// --- local noon ---------------------------------------------------------------
test('local noon is 05:00 UTC in Vietnam', () => {
  assert.equal(zonedNoonInstant('2026-08-21', VN).toISOString(), '2026-08-21T05:00:00.000Z');
  assert.equal(zonedNoonInstant('2026-01-01', VN).toISOString(), '2026-01-01T05:00:00.000Z');
});

test('local noon always falls on the requested local day', () => {
  // Noon is chosen precisely so it can never spill into an adjacent day.
  for (const date of ['2026-01-01', '2026-06-15', '2026-08-21', '2026-12-31']) {
    assert.equal(toZonedDate(zonedNoonInstant(date, VN), VN), date);
  }
});

// --- currentAppDate -----------------------------------------------------------
test('currentAppDate honours the zone it is given', () => {
  const instant = new Date('2026-08-21T20:00:00Z');
  assert.equal(currentAppDate(instant, VN), '2026-08-22');
  assert.equal(currentAppDate(instant, 'UTC'), '2026-08-21');
});

test('currentAppDate defaults to the configured application timezone', () => {
  // No zone argument: it must use APP_TIMEZONE rather than the host's zone or
  // UTC. Compared against an explicit call to avoid depending on which zone is
  // configured in this environment.
  const instant = new Date('2026-08-21T20:00:00Z');
  assert.equal(currentAppDate(instant), toZonedDate(instant, env.APP_TIMEZONE));
});

test('currentAppDate returns a well-formed date for the real clock', () => {
  assert.match(currentAppDate(), /^\d{4}-\d{2}-\d{2}$/);
});

// --- calendar arithmetic stays zone-free --------------------------------------
test('addDays and week maths remain pure string arithmetic', () => {
  // These were deliberately NOT changed: they operate on calendar dates, which
  // have no timezone. Only the instant-to-date conversion is zone-aware.
  assert.equal(addDays('2026-08-21', 1), '2026-08-22');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(startOfIsoWeek('2026-08-21'), '2026-08-17');
  assert.equal(endOfIsoWeek('2026-08-21'), '2026-08-23');
});
