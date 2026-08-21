import { z } from 'zod';
import { isValidIsoDate } from '../utils/dates.js';

/**
 * `?date=YYYY-MM-DD`, optional on both prediction endpoints.
 *
 * The format is checked AND the value is checked for being a real calendar
 * day, so `2026-02-30` is refused rather than rolling forward into March and
 * quietly caching a prediction under the wrong key.
 *
 * The upper bound is the interesting one. Without it, `?date=9999-12-31` would
 * be a free instruction to generate — and pay for — a brand new reading, and a
 * script walking a range could mint unlimited AI calls that all pass the
 * cache. Readings exist for reflection on a real day, so the window is the
 * recent past through the near future.
 */
const MAX_DAYS_AHEAD = 370;
const MAX_DAYS_BEHIND = 370;

const MS_PER_DAY = 86_400_000;

function withinAllowedWindow(date: string, today: string): boolean {
  const difference = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / MS_PER_DAY,
  );
  return difference <= MAX_DAYS_AHEAD && difference >= -MAX_DAYS_BEHIND;
}

export function buildDateQuerySchema(today: string) {
  return z.object({
    date: z
      .string()
      .trim()
      .refine(isValidIsoDate, 'date must be a real calendar date in YYYY-MM-DD form')
      .refine(
        (value) => withinAllowedWindow(value, today),
        `date must be within ${MAX_DAYS_BEHIND} days of today`,
      )
      .optional(),
  });
}

export type DateQuery = z.infer<ReturnType<typeof buildDateQuerySchema>>;

export const DATE_WINDOW = { MAX_DAYS_AHEAD, MAX_DAYS_BEHIND } as const;
