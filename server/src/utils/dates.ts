/**
 * Calendar arithmetic for prediction dates.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. A date is a STRING in 'YYYY-MM-DD' form, never a `Date`. A `Date` is an
 *     instant in time; a prediction date is a day on a calendar. Mixing them
 *     is how "today" silently becomes "yesterday" for anyone east of UTC.
 *     `pg` is configured (in db/pool.ts) to hand back date columns as strings
 *     for the same reason.
 *
 *  2. Calendar arithmetic goes through `Date.UTC` and never reads the host's
 *     timezone or locale, so `addDays`, `startOfIsoWeek` and friends produce
 *     the same output on a laptop, in CI, and on a serverless instance.
 *     Those functions are pure string maths and know nothing about zones.
 *
 * TIMEZONE SEMANTICS — all of it lives in this file, and nowhere else:
 *
 *   `toZonedDate`        which calendar day an instant falls on, in a zone
 *   `zoneOffsetMinutes`  that zone's UTC offset, read from the tz database
 *   `zonedNoonInstant`   the instant of local noon on a given day
 *   `currentAppDate`     what "today" means for the application
 *
 * The application day rolls over at midnight in APP_TIMEZONE
 * (Asia/Ho_Chi_Minh — 17:00 UTC the previous day). Only `currentAppDate`
 * decides this; moving to a per-user timezone later means changing that one
 * function's callers, not hunting through the codebase.
 *
 * No timezone library is needed: `Intl` carries the IANA database, and Node 18+
 * ships full ICU. Vietnam has a fixed +07:00 offset and observes no DST.
 */
import { env } from '../config/env.js';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const SHORT_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export type DayName = (typeof DAY_NAMES)[number];

const MS_PER_DAY = 86_400_000;

/** True only for a well-formed string that is also a real calendar date. */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const timestamp = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(timestamp);

  // Rejects 2026-02-30 and 2026-13-01, which Date.UTC would otherwise roll
  // forward into a different, valid-looking day.
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  );
}

function toTimestamp(iso: string): number {
  if (!isValidIsoDate(iso)) {
    throw new Error(`Not a valid ISO date: ${JSON.stringify(iso)}`);
  }
  const match = ISO_DATE_PATTERN.exec(iso);
  // Guarded by isValidIsoDate above.
  const [, year, month, day] = match as RegExpExecArray & [string, string, string, string];
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * The calendar date an instant falls on, as seen from `timeZone`.
 *
 * `en-CA` is not a locale preference — it is the one widely-supported locale
 * whose short date format is already 'YYYY-MM-DD', so no reformatting or
 * part-shuffling is needed.
 *
 * Pure: the host's own timezone is never consulted, only the zone passed in.
 */
export function toZonedDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * The zone's UTC offset in minutes at a given instant.
 *
 * Read from the timezone database rather than assumed, so the logic stays
 * correct if APP_TIMEZONE is ever changed to a zone that observes DST.
 * Vietnam is a fixed +07:00 with no DST, so today this is always 420.
 */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant);

  const label = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label);
  if (!match) return 0; // 'GMT' with no offset means UTC.

  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The instant corresponding to local NOON on `date` in `timeZone`.
 *
 * Astronomical values are sampled at local noon rather than midnight: the Moon
 * moves roughly 13 degrees a day, so a value taken at a day's edge can land on
 * the far side of a sign or phase boundary and misrepresent the day as a
 * whole. Noon is the least surprising representative moment, and it is also
 * never ambiguous under a DST transition (those happen near 02:00-03:00).
 */
export function zonedNoonInstant(date: string, timeZone: string): Date {
  const midday = toTimestamp(date) + 12 * 3_600_000;
  const offset = zoneOffsetMinutes(new Date(midday), timeZone);
  return new Date(midday - offset * 60_000);
}

/**
 * The application's current date, in the configured application timezone.
 *
 * This is the ONE function that decides what "today" means. The product is
 * aimed at readers in Vietnam, so the day rolls over at midnight
 * Asia/Ho_Chi_Minh (17:00 UTC the previous day) rather than at UTC midnight —
 * otherwise a reader opening the app at 9pm local would already be shown the
 * next day's reading.
 *
 * `now` and `timeZone` are parameters so tests can pin both; production passes
 * neither.
 */
export function currentAppDate(now: Date = new Date(), timeZone: string = env.APP_TIMEZONE): string {
  return toZonedDate(now, timeZone);
}

export function addDays(iso: string, days: number): string {
  return toIso(toTimestamp(iso) + days * MS_PER_DAY);
}

/** 0 = Monday ... 6 = Sunday. (JavaScript's own numbering starts at Sunday.) */
export function isoWeekDayIndex(iso: string): number {
  const jsDay = new Date(toTimestamp(iso)).getUTCDay();
  return (jsDay + 6) % 7;
}

/** The Monday of the ISO week containing `iso`. */
export function startOfIsoWeek(iso: string): string {
  return addDays(iso, -isoWeekDayIndex(iso));
}

/** The Sunday of the ISO week containing `iso`. */
export function endOfIsoWeek(iso: string): string {
  return addDays(startOfIsoWeek(iso), 6);
}

/** The seven dates of the week beginning at `weekStart`, Monday first. */
export function eachDayOfWeek(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_unused, index) => addDays(weekStart, index));
}

export function dayNameOf(iso: string): DayName {
  // Fixed table rather than `toLocaleDateString`: locale data would make the
  // stored value depend on the host's configuration.
  return DAY_NAMES[isoWeekDayIndex(iso)] as DayName;
}

export function shortNameOf(iso: string): string {
  return SHORT_NAMES[isoWeekDayIndex(iso)] as string;
}

export function dayNameByIndex(index: number): DayName {
  const name = DAY_NAMES[index];
  if (!name) throw new Error(`Day index out of range: ${index}`);
  return name;
}

/** Difference in whole days, `to - from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toTimestamp(to) - toTimestamp(from)) / MS_PER_DAY);
}
