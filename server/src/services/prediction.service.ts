import { getPool } from '../db/pool.js';
import { withTransaction } from '../db/query.js';
import {
  findDailyByDate,
  findWeeklyByStart,
  findWeeklyDays,
  insertDailyIfAbsent,
  insertWeeklyDays,
  insertWeeklyIfAbsent,
  type DailyPredictionRow,
  type WeeklyDayRow,
  type WeeklyPredictionRow,
} from '../repositories/prediction.repository.js';
import { generateValidated, getAIProvider } from './ai/index.js';
import { buildDailyPrompt, buildWeeklyPrompt } from './ai/prompts.js';
import { buildAstronomyContext } from './astronomy/index.js';
import type { AIProvider } from './ai/AIProvider.js';
import { dailyPredictionDraftSchema, weeklyPredictionDraftSchema } from './ai/schemas.js';
import {
  addDays,
  dayNameByIndex,
  dayNameOf,
  daysBetween,
  eachDayOfWeek,
  endOfIsoWeek,
  shortNameOf,
  startOfIsoWeek,
} from '../utils/dates.js';
import { AppError } from '../utils/errors.js';

// --- response shapes -------------------------------------------------------

export interface DailyPredictionDto {
  date: string;
  theme: string;
  energy: string;
  energyScore: number;
  luckyColor: string;
  luckyColorHex: string | null;
  luckyNumber: number;
  mood: string;
  prediction: string;
  cosmicQuote: string | null;
  cosmicSign: string | null;
  element: string | null;
  soundFrequency: string | null;
}

export interface WeeklyDayDto {
  id: string;
  date: string;
  day: string;
  shortName: string;
  type: string;
  tagline: string;
  prediction: string;
  score: number;
  isPeak: boolean;
  element: string | null;
  gemstone: string | null;
  /** Present only on the brightest day. Omitted entirely otherwise. */
  highlightTitle?: string;
  highlightQuote?: string;
}

export interface WeeklyPredictionDto {
  weekStart: string;
  weekEnd: string;
  summary: string;
  brightestDay: string;
  days: WeeklyDayDto[];
}

// --- mapping ---------------------------------------------------------------

function toDailyDto(row: DailyPredictionRow): DailyPredictionDto {
  return {
    date: row.date,
    theme: row.theme,
    energy: row.energy,
    energyScore: row.energy_score,
    luckyColor: row.lucky_color,
    luckyColorHex: row.lucky_color_hex,
    // A number, not a padded string: presentation ("07", "87%") belongs to the
    // frontend, and a number keeps the value usable for anything else.
    luckyNumber: row.lucky_number,
    mood: row.mood,
    prediction: row.prediction_text,
    cosmicQuote: row.cosmic_quote,
    cosmicSign: row.cosmic_sign,
    element: row.element,
    soundFrequency: row.sound_frequency,
  };
}

function toWeeklyDto(week: WeeklyPredictionRow, dayRows: WeeklyDayRow[]): WeeklyPredictionDto {
  return {
    weekStart: week.week_start,
    weekEnd: week.week_end,
    summary: week.summary,
    brightestDay: week.brightest_day,
    days: dayRows.map((row) => {
      const day: WeeklyDayDto = {
        id: row.id,
        date: row.day_date,
        day: row.day_name,
        shortName: row.short_name,
        type: row.day_type,
        tagline: row.tagline,
        prediction: row.prediction_text,
        score: row.score,
        isPeak: row.is_peak,
        element: row.element,
        gemstone: row.gemstone,
      };

      // The highlight is stored once on the week and projected onto the day it
      // describes. Lumiere lesson section 7: absent fields are OMITTED, never
      // sent as "" — an empty string is truthy on the client and renders as a
      // blank heading rather than falling back.
      if (row.is_peak) {
        if (week.highlight_title) day.highlightTitle = week.highlight_title;
        if (week.highlight_quote) day.highlightQuote = week.highlight_quote;
      }

      // `energy` and `mood` are absent by design: the columns are nullable,
      // nothing generates them, and the UI renders neither.
      return day;
    }),
  };
}

// --- the exactly-seven-days invariant --------------------------------------

/**
 * Asserts that a set of day rows really is one whole week.
 *
 * Checked on the way IN (before anything is written) and again on the way OUT
 * (after every read). The second check is not redundant: it catches a row
 * deleted directly in the database, a partially applied future migration, or a
 * bug in a later phase. A week that cannot satisfy this is reported as an
 * error rather than rendered — the frontend indexes this list positionally and
 * would throw on a missing entry.
 *
 * It never repairs: no truncating an eighth day, no padding a sixth.
 */
export function assertWholeWeek(
  weekStart: string,
  weekEnd: string,
  dates: readonly string[],
): void {
  const problems: string[] = [];

  if (dates.length !== 7) {
    problems.push(`expected 7 days, found ${dates.length}`);
  }
  if (new Set(dates).size !== dates.length) {
    problems.push('contains duplicate dates');
  }

  const expected = eachDayOfWeek(weekStart);
  if (dates.length === 7) {
    for (let index = 0; index < 7; index += 1) {
      if (dates[index] !== expected[index]) {
        problems.push(`day ${index} should be ${expected[index]}, found ${dates[index]}`);
      }
    }
  }
  if (daysBetween(weekStart, weekEnd) !== 6) {
    problems.push(`weekEnd ${weekEnd} is not 6 days after weekStart ${weekStart}`);
  }

  if (problems.length > 0) {
    // Server-side detail; the client gets the controlled message below.
    console.error(`[prediction] week ${weekStart} failed its invariant: ${problems.join('; ')}`);
    throw AppError.upstream("This week's forecast could not be assembled. Please try again.");
  }
}

// --- daily -----------------------------------------------------------------

/**
 * Returns the prediction for `date`, generating it only if none exists.
 *
 * THE DATABASE IS THE SOURCE OF TRUTH. A date has at most one prediction, for
 * its whole lifetime. Refreshing the page re-reads that row; it never produces
 * a new reading, and never calls the provider again.
 */
export async function getDailyPrediction(
  date: string,
  provider: AIProvider = getAIProvider(),
): Promise<DailyPredictionDto> {
  const pool = getPool();

  const existing = await findDailyByDate(pool, date);
  if (existing) return toDailyDto(existing);

  // Deterministic facts FIRST. The model is told what the sky is doing; it is
  // never asked to work it out.
  const astronomy = buildAstronomyContext(date);
  const prompt = buildDailyPrompt(astronomy, dayNameOf(date));

  const draft = await generateValidated(`daily:${date}`, dailyPredictionDraftSchema, () =>
    provider.generate({ task: 'daily', ...prompt, seed: date }),
  );

  const inserted = await insertDailyIfAbsent(pool, {
    date,
    theme: draft.theme,
    energy: draft.energy,
    energyScore: draft.energyScore,
    luckyColor: draft.luckyColor,
    luckyColorHex: draft.luckyColorHex,
    luckyNumber: draft.luckyNumber,
    mood: draft.mood,
    predictionText: draft.prediction,
    cosmicQuote: draft.cosmicQuote,
    cosmicSign: draft.cosmicSign,
    element: draft.element,
    soundFrequency: draft.soundFrequency,
    model: provider.name,
    astronomy,
  });

  if (inserted) return toDailyDto(inserted);

  // Another request generated and stored this date first. Its row wins; ours
  // is discarded. Both callers see the same reading, which is the point.
  const winner = await findDailyByDate(pool, date);
  if (!winner) {
    throw AppError.upstream("Today's reading could not be saved. Please try again.");
  }
  return toDailyDto(winner);
}

// --- weekly ----------------------------------------------------------------

async function readWeek(
  db: Parameters<typeof findWeeklyDays>[0],
  week: WeeklyPredictionRow,
): Promise<WeeklyPredictionDto> {
  const dayRows = await findWeeklyDays(db, week.id);
  assertWholeWeek(
    week.week_start,
    week.week_end,
    dayRows.map((row) => row.day_date),
  );
  return toWeeklyDto(week, dayRows);
}

/**
 * Returns the forecast for the ISO week containing `date`, generating it only
 * if none exists. One forecast per week, for the life of that week.
 */
export async function getWeeklyPrediction(
  date: string,
  provider: AIProvider = getAIProvider(),
): Promise<WeeklyPredictionDto> {
  const pool = getPool();
  const weekStart = startOfIsoWeek(date);
  const weekEnd = endOfIsoWeek(date);

  const existing = await findWeeklyByStart(pool, weekStart);
  if (existing) return readWeek(pool, existing);

  const astronomy = buildAstronomyContext(weekStart);
  const prompt = buildWeeklyPrompt(astronomy, weekStart, weekEnd);

  const draft = await generateValidated(`weekly:${weekStart}`, weeklyPredictionDraftSchema, () =>
    provider.generate({ task: 'weekly', ...prompt, seed: weekStart }),
  );

  // The model supplies a day INDEX; the real date comes from the requested
  // week. Dates therefore cannot be duplicated, skipped, or drawn from a
  // different week, whatever the model returns.
  const ordered = [...draft.days].sort((left, right) => left.dayIndex - right.dayIndex);
  const dayInputs = ordered.map((day) => {
    const dayDate = addDays(weekStart, day.dayIndex);
    return {
      dayDate,
      dayName: dayNameOf(dayDate),
      shortName: shortNameOf(dayDate),
      dayType: day.dayType,
      tagline: day.tagline,
      predictionText: day.advice,
      score: day.score,
      isPeak: day.dayIndex === draft.brightestDayIndex,
      element: day.element,
      gemstone: day.gemstone,
    };
  });

  // Verified BEFORE the write. Nothing invalid is ever stored.
  assertWholeWeek(
    weekStart,
    weekEnd,
    dayInputs.map((day) => day.dayDate),
  );

  const brightestDay = dayNameByIndex(draft.brightestDayIndex);

  return withTransaction(async (client) => {
    const inserted = await insertWeeklyIfAbsent(client, {
      weekStart,
      weekEnd,
      summary: draft.summary,
      brightestDay,
      highlightTitle: draft.highlightTitle,
      highlightQuote: draft.highlightQuote,
      model: provider.name,
      astronomy,
    });

    if (inserted) {
      // Parent and all seven days commit together, so no reader can ever
      // observe a week with a partial set of days.
      await insertWeeklyDays(client, inserted.id, dayInputs);
      return readWeek(client, inserted);
    }

    // Lost the race. `ON CONFLICT` waited for the winning transaction to
    // finish, so its week and its seven days are both visible now.
    const winner = await findWeeklyByStart(client, weekStart);
    if (!winner) {
      throw AppError.upstream("This week's forecast could not be saved. Please try again.");
    }
    return readWeek(client, winner);
  });
}
