import type { Queryable } from '../db/query.js';
import { queryAll, queryOne } from '../db/query.js';

/**
 * Row shapes exactly as Postgres returns them: snake_case, and `date` columns
 * as 'YYYY-MM-DD' strings (see the type parser registered in db/pool.ts).
 * Mapping to the API's camelCase happens in the service, so a column rename
 * cannot silently change the public contract.
 */
export interface DailyPredictionRow {
  id: string;
  date: string;
  theme: string;
  energy: string;
  energy_score: number;
  lucky_color: string;
  lucky_color_hex: string | null;
  lucky_number: number;
  mood: string;
  prediction_text: string;
  cosmic_quote: string | null;
  cosmic_sign: string | null;
  element: string | null;
  sound_frequency: string | null;
  model: string;
  astronomy: unknown;
  created_at: Date;
}

export interface WeeklyPredictionRow {
  id: string;
  week_start: string;
  week_end: string;
  summary: string;
  brightest_day: string;
  highlight_title: string | null;
  highlight_quote: string | null;
  model: string;
  astronomy: unknown;
  created_at: Date;
}

export interface WeeklyDayRow {
  id: string;
  weekly_prediction_id: string;
  day_date: string;
  day_name: string;
  short_name: string;
  day_type: string;
  tagline: string;
  prediction_text: string;
  score: number;
  is_peak: boolean;
  element: string | null;
  gemstone: string | null;
}

const DAILY_COLUMNS = `
  id, date, theme, energy, energy_score, lucky_color, lucky_color_hex,
  lucky_number, mood, prediction_text, cosmic_quote, cosmic_sign, element,
  sound_frequency, model, astronomy, created_at
`;

const WEEKLY_COLUMNS = `
  id, week_start, week_end, summary, brightest_day, highlight_title,
  highlight_quote, model, astronomy, created_at
`;

const WEEKLY_DAY_COLUMNS = `
  id, weekly_prediction_id, day_date, day_name, short_name, day_type, tagline,
  prediction_text, score, is_peak, element, gemstone
`;

// --- daily -----------------------------------------------------------------

export interface InsertDailyInput {
  subjectId: string;
  date: string;
  theme: string;
  energy: string;
  energyScore: number;
  luckyColor: string;
  luckyColorHex: string;
  luckyNumber: number;
  mood: string;
  predictionText: string;
  cosmicQuote: string;
  cosmicSign: string;
  element: string;
  soundFrequency: string;
  model: string;
  astronomy: unknown;
}

export async function findDailyByDate(
  db: Queryable,
  date: string,
  subjectId: string,
): Promise<DailyPredictionRow | undefined> {
  return queryOne<DailyPredictionRow>(
    db,
    `SELECT ${DAILY_COLUMNS}
       FROM daily_predictions
      WHERE subject_id = $1 AND date = $2`,
    [subjectId, date],
  );
}

/**
 * Inserts a prediction unless one already exists for that date.
 *
 * `ON CONFLICT (subject_id, date) DO NOTHING` closes the race that a plain
 * SELECT-then-INSERT leaves open: two cold serverless instances handling the
 * same subject's first request of the day would both see no row, both
 * generate, and both insert. Here the loser's insert is a no-op and it reads
 * the winner's row instead.
 *
 * Returns `undefined` when another writer won, which is a normal outcome and
 * not an error.
 */
export async function insertDailyIfAbsent(
  db: Queryable,
  input: InsertDailyInput,
): Promise<DailyPredictionRow | undefined> {
  return queryOne<DailyPredictionRow>(
    db,
    `INSERT INTO daily_predictions
       (subject_id, date, theme, energy, energy_score, lucky_color,
        lucky_color_hex, lucky_number, mood, prediction_text, cosmic_quote,
        cosmic_sign, element, sound_frequency, model, astronomy)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (subject_id, date) DO NOTHING
     RETURNING ${DAILY_COLUMNS}`,
    [
      input.subjectId,
      input.date,
      input.theme,
      input.energy,
      input.energyScore,
      input.luckyColor,
      input.luckyColorHex,
      input.luckyNumber,
      input.mood,
      input.predictionText,
      input.cosmicQuote,
      input.cosmicSign,
      input.element,
      input.soundFrequency,
      input.model,
      input.astronomy,
    ],
  );
}

// --- weekly ----------------------------------------------------------------

export interface InsertWeeklyInput {
  subjectId: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  brightestDay: string;
  highlightTitle: string;
  highlightQuote: string;
  model: string;
  astronomy: unknown;
}

export interface InsertWeeklyDayInput {
  dayDate: string;
  dayName: string;
  shortName: string;
  dayType: string;
  tagline: string;
  predictionText: string;
  score: number;
  isPeak: boolean;
  element: string;
  gemstone: string;
}

export async function findWeeklyByStart(
  db: Queryable,
  weekStart: string,
  subjectId: string,
): Promise<WeeklyPredictionRow | undefined> {
  return queryOne<WeeklyPredictionRow>(
    db,
    `SELECT ${WEEKLY_COLUMNS}
       FROM weekly_predictions
      WHERE subject_id = $1 AND week_start = $2`,
    [subjectId, weekStart],
  );
}

/** Ordered by date, so the caller receives Monday first without re-sorting. */
export async function findWeeklyDays(db: Queryable, weeklyId: string): Promise<WeeklyDayRow[]> {
  return queryAll<WeeklyDayRow>(
    db,
    `SELECT ${WEEKLY_DAY_COLUMNS}
       FROM weekly_prediction_days
      WHERE weekly_prediction_id = $1
      ORDER BY day_date ASC`,
    [weeklyId],
  );
}

/** Same race-safe strategy as the daily insert, keyed on (subject, week_start). */
export async function insertWeeklyIfAbsent(
  db: Queryable,
  input: InsertWeeklyInput,
): Promise<WeeklyPredictionRow | undefined> {
  return queryOne<WeeklyPredictionRow>(
    db,
    `INSERT INTO weekly_predictions
       (subject_id, week_start, week_end, summary, brightest_day,
        highlight_title, highlight_quote, model, astronomy)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (subject_id, week_start) DO NOTHING
     RETURNING ${WEEKLY_COLUMNS}`,
    [
      input.subjectId,
      input.weekStart,
      input.weekEnd,
      input.summary,
      input.brightestDay,
      input.highlightTitle,
      input.highlightQuote,
      input.model,
      input.astronomy,
    ],
  );
}

/**
 * Inserts all seven days in ONE statement.
 *
 * A single multi-row insert means the seven rows share the fate of one
 * statement inside the caller's transaction: there is no interleaving in which
 * a week ends up with three days committed. `energy` and `mood` are left unset
 * — the current UI renders neither, and filling them would mean inventing
 * content nothing displays.
 */
export async function insertWeeklyDays(
  db: Queryable,
  weeklyId: string,
  days: readonly InsertWeeklyDayInput[],
): Promise<void> {
  const COLUMNS_PER_ROW = 11;
  const values: unknown[] = [];

  const tuples = days.map((day, index) => {
    values.push(
      weeklyId,
      day.dayDate,
      day.dayName,
      day.shortName,
      day.dayType,
      day.tagline,
      day.predictionText,
      day.score,
      day.isPeak,
      day.element,
      day.gemstone,
    );

    // Placeholder positions come from the loop index only. Every actual value
    // travels as a bound parameter, so nothing user- or model-supplied is ever
    // part of the SQL text.
    const base = index * COLUMNS_PER_ROW;
    const placeholders = Array.from(
      { length: COLUMNS_PER_ROW },
      (_unused, offset) => `$${base + offset + 1}`,
    );
    return `(${placeholders.join(',')})`;
  });

  await db.query(
    `INSERT INTO weekly_prediction_days
       (weekly_prediction_id, day_date, day_name, short_name, day_type,
        tagline, prediction_text, score, is_peak, element, gemstone)
     VALUES ${tuples.join(', ')}`,
    values,
  );
}
