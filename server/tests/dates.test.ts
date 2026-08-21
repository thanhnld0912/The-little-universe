import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  currentAppDate,
  dayNameByIndex,
  dayNameOf,
  daysBetween,
  eachDayOfWeek,
  endOfIsoWeek,
  isValidIsoDate,
  isoWeekDayIndex,
  shortNameOf,
  startOfIsoWeek,
} from '../src/utils/dates.js';

test('a well-formed real date is accepted', () => {
  for (const date of ['2026-08-21', '2026-01-01', '2026-12-31', '2024-02-29']) {
    assert.equal(isValidIsoDate(date), true, `${date} should be valid`);
  }
});

test('impossible dates are rejected rather than rolled forward', () => {
  // Date.UTC would happily turn these into a different, valid-looking day.
  for (const date of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2025-02-29']) {
    assert.equal(isValidIsoDate(date), false, `${date} should be rejected`);
  }
});

test('malformed date strings are rejected', () => {
  for (const value of [
    '',
    '2026-8-21',
    '26-08-21',
    '2026/08/21',
    '2026-08-21T00:00:00Z',
    'today',
    '2026-08-21 ',
    'DROP TABLE users',
  ]) {
    assert.equal(isValidIsoDate(value), false, `${JSON.stringify(value)} should be rejected`);
  }
});

test('the application date is derived from an explicit zone, never the host', () => {
  // Passing the zone explicitly keeps this independent of both the host
  // machine and whatever APP_TIMEZONE is configured to. The application's
  // actual boundary behaviour is covered in tests/timezone.test.ts.
  const instant = new Date('2026-08-21T23:30:00Z');
  assert.equal(currentAppDate(instant, 'UTC'), '2026-08-21');
  assert.equal(currentAppDate(instant, 'Asia/Ho_Chi_Minh'), '2026-08-22');
});

test('addDays crosses month, year and leap boundaries', () => {
  assert.equal(addDays('2026-08-21', 1), '2026-08-22');
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2023-02-28', 1), '2023-03-01');
  assert.equal(addDays('2026-08-21', 0), '2026-08-21');
});

test('the week index runs Monday=0 to Sunday=6', () => {
  // 2026-08-17 is a Monday.
  assert.equal(isoWeekDayIndex('2026-08-17'), 0);
  assert.equal(isoWeekDayIndex('2026-08-21'), 4);
  assert.equal(isoWeekDayIndex('2026-08-23'), 6);
});

test('every day of a week resolves to the same Monday', () => {
  const expected = '2026-08-17';
  for (const date of eachDayOfWeek(expected)) {
    assert.equal(startOfIsoWeek(date), expected, `${date} should belong to week ${expected}`);
  }
});

test('Sunday belongs to the week that began the previous Monday', () => {
  // The classic off-by-one: JavaScript numbers Sunday as 0, which would place
  // it at the START of a week rather than the end.
  assert.equal(startOfIsoWeek('2026-08-23'), '2026-08-17');
  assert.equal(endOfIsoWeek('2026-08-17'), '2026-08-23');
});

test('a week is seven consecutive days, Monday first', () => {
  const days = eachDayOfWeek('2026-08-17');
  assert.equal(days.length, 7);
  assert.deepEqual(days, [
    '2026-08-17',
    '2026-08-18',
    '2026-08-19',
    '2026-08-20',
    '2026-08-21',
    '2026-08-22',
    '2026-08-23',
  ]);
  assert.equal(new Set(days).size, 7, 'no duplicates');
  for (let index = 1; index < days.length; index += 1) {
    assert.equal(daysBetween(days[index - 1] as string, days[index] as string), 1);
  }
});

test('a week spanning a month boundary is still seven consecutive days', () => {
  const days = eachDayOfWeek('2026-08-31');
  assert.deepEqual(days, [
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
  ]);
});

test('day names come from a fixed table, not host locale data', () => {
  assert.equal(dayNameOf('2026-08-17'), 'Monday');
  assert.equal(dayNameOf('2026-08-21'), 'Friday');
  assert.equal(dayNameOf('2026-08-23'), 'Sunday');
  assert.equal(shortNameOf('2026-08-17'), 'MON');
  assert.equal(shortNameOf('2026-08-21'), 'FRI');
  assert.equal(dayNameByIndex(0), 'Monday');
  assert.equal(dayNameByIndex(4), 'Friday');
  assert.throws(() => dayNameByIndex(7), /out of range/);
});

test('date arithmetic refuses invalid input instead of guessing', () => {
  assert.throws(() => addDays('2026-02-30', 1), /valid ISO date/);
  assert.throws(() => startOfIsoWeek('nonsense'), /valid ISO date/);
});

test('daysBetween is signed and exact', () => {
  assert.equal(daysBetween('2026-08-17', '2026-08-23'), 6);
  assert.equal(daysBetween('2026-08-23', '2026-08-17'), -6);
  assert.equal(daysBetween('2026-08-17', '2026-08-17'), 0);
});
