/**
 * Zod schemas for AI output.
 *
 * MODEL OUTPUT IS EXTERNAL DATA. It is produced by another system, over a
 * network, and is shaped by a prompt rather than a contract. Lumiere's final
 * audit (lesson.md section 11) found four real defects that all came from
 * trusting a document written by another process: a missing field crashed the
 * reader, the string `"no"` passed a truthiness check, and an unverified
 * `source` field was believed. Every field below is therefore checked for
 * presence, type, range, and internal consistency before it can reach the
 * database.
 *
 * `strictObject` matters as much as the field rules: a provider that invents
 * an extra key is rejected rather than having it silently dropped or stored.
 *
 * Note what the AI is NOT asked for:
 *   - dates. The service assigns them from the requested week, so a model can
 *     never produce a duplicate, a gap, or a date from the wrong week.
 *   - `energy` / `mood` for weekly days. The current UI renders neither, so
 *     generating them would be inventing content nothing displays.
 */
import { z } from 'zod';

/**
 * The closed set the frontend switches on to pick a day's icon. An
 * unrecognised value degrades silently to a generic icon there, so it is
 * rejected here and constrained again by a CHECK constraint in the database.
 */
export const DAY_TYPES = ['QUIET', 'FLOW', 'PIVOT', 'CLARITY', 'PEAK', 'REST', 'REFLECT'] as const;
export type DayType = (typeof DAY_TYPES)[number];

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const dailyPredictionDraftSchema = z.strictObject({
  /** "Unexpected Moments" */
  theme: shortText(80),
  /** The energy TITLE, e.g. "Quietly Curious" — not a number. */
  energy: shortText(60),
  /** 0-100, rendered as a percentage. */
  energyScore: z.number().int().min(0).max(100),
  /** "Dusty Rose" */
  luckyColor: shortText(40),
  /** Must be a 6-digit hex colour: it is bound to a CSS background. */
  luckyColorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'luckyColorHex must be a #RRGGBB colour'),
  luckyNumber: z.number().int().min(0).max(99),
  /** "Hopeful" — may carry a leading emoji. */
  mood: shortText(40),
  /** The main reading shown on the card. */
  prediction: shortText(700),
  cosmicQuote: shortText(220),
  cosmicSign: shortText(80),
  element: shortText(60),
  soundFrequency: shortText(60),
});

export type DailyPredictionDraft = z.infer<typeof dailyPredictionDraftSchema>;

export const weeklyDayDraftSchema = z.strictObject({
  /** 0 = Monday ... 6 = Sunday. The service turns this into a real date. */
  dayIndex: z.number().int().min(0).max(6),
  dayType: z.enum(DAY_TYPES),
  tagline: shortText(160),
  /** Rendered as "Celestial Guidance" in the day detail dialog. */
  advice: shortText(500),
  /** 0-100, drawn as the day's battery level. */
  score: z.number().int().min(0).max(100),
  element: shortText(60),
  gemstone: shortText(60),
});

export type WeeklyDayDraft = z.infer<typeof weeklyDayDraftSchema>;

export const weeklyPredictionDraftSchema = z
  .strictObject({
    summary: shortText(500),
    /** Which day is brightest, as an index into the same 0-6 scheme. */
    brightestDayIndex: z.number().int().min(0).max(6),
    highlightTitle: shortText(120),
    highlightQuote: shortText(220),
    days: z.array(weeklyDayDraftSchema).length(7, 'a week must contain exactly 7 days'),
  })
  .superRefine((value, ctx) => {
    // `.length(7)` alone would accept seven copies of Monday. The set of
    // indices must be a permutation of 0..6 — that is what makes the dates the
    // service derives complete, consecutive and duplicate-free.
    const indices = value.days.map((day) => day.dayIndex);
    const unique = new Set(indices);

    if (unique.size !== 7) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: `days must cover each of the 7 dayIndex values exactly once (got [${indices.join(', ')}])`,
      });
      return;
    }

    // The brightest day must be one the model actually described, and it must
    // be the day it marked PEAK. An internally inconsistent document is
    // rejected rather than reconciled by guessing.
    const peakDays = value.days.filter((day) => day.dayType === 'PEAK');
    if (peakDays.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: `exactly one day must have dayType "PEAK" (got ${peakDays.length})`,
      });
      return;
    }
    if (peakDays[0]?.dayIndex !== value.brightestDayIndex) {
      ctx.addIssue({
        code: 'custom',
        path: ['brightestDayIndex'],
        message: 'brightestDayIndex must be the day marked PEAK',
      });
    }
  });

export type WeeklyPredictionDraft = z.infer<typeof weeklyPredictionDraftSchema>;
