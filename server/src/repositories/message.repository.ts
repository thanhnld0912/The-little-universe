import type { Queryable } from '../db/query.js';
import { queryOne } from '../db/query.js';

/**
 * The row exactly as Postgres returns it: snake_case, `date` as a
 * 'YYYY-MM-DD' string (see the type parser in db/pool.ts). Mapping to the API's
 * camelCase happens in the service, so a column rename cannot silently change
 * the public contract.
 */
export interface UniverseMessageRow {
  id: string;
  subject_id: string;
  date: string;
  mood: string;
  prompt: string;
  title: string;
  subtitle: string;
  whisper: string;
  affirmation: string;
  action_guidance: string;
  lucky_number: number;
  cosmic_energy: string;
  celestial_sign: string;
  model: string;
  astronomy: unknown;
  created_at: Date;
}

export interface InsertMessageInput {
  subjectId: string;
  date: string;
  mood: string;
  /** '' when they wrote nothing. Never null — see migration 006. */
  prompt: string;
  title: string;
  subtitle: string;
  whisper: string;
  affirmation: string;
  actionGuidance: string;
  luckyNumber: number;
  cosmicEnergy: string;
  celestialSign: string;
  model: string;
  astronomy: unknown;
}

const COLUMNS = `
  id, subject_id, date, mood, prompt, title, subtitle, whisper, affirmation,
  action_guidance, lucky_number, cosmic_energy, celestial_sign, model,
  astronomy, created_at
`;

/** Finds the message this exact request already produced, if any. */
export async function findMessage(
  db: Queryable,
  subjectId: string,
  date: string,
  mood: string,
  prompt: string,
): Promise<UniverseMessageRow | undefined> {
  return queryOne<UniverseMessageRow>(
    db,
    `SELECT ${COLUMNS}
       FROM universe_messages
      WHERE subject_id = $1 AND date = $2 AND mood = $3 AND prompt = $4`,
    [subjectId, date, mood, prompt],
  );
}

/**
 * Finds one of THIS SUBJECT'S messages by id.
 *
 * Scoped to the subject deliberately. The id alone must not be enough to read a
 * message, because ids appear in share payloads and in client state; sharing is
 * the one way a message becomes readable by anyone else, and it goes through a
 * slug rather than through this.
 */
export async function findMessageById(
  db: Queryable,
  id: string,
  subjectId: string,
): Promise<UniverseMessageRow | undefined> {
  return queryOne<UniverseMessageRow>(
    db,
    `SELECT ${COLUMNS} FROM universe_messages WHERE id = $1 AND subject_id = $2`,
    [id, subjectId],
  );
}

/**
 * Inserts unless this exact request already has a message.
 *
 * Same race-safe strategy as the predictions: two cold serverless instances
 * handling a double-tap would both find nothing and both generate. The loser's
 * insert becomes a no-op and it reads the winner's row instead, so the person
 * sees one message rather than two.
 *
 * Returns `undefined` when another writer won, which is normal and not an error.
 */
export async function insertMessageIfAbsent(
  db: Queryable,
  input: InsertMessageInput,
): Promise<UniverseMessageRow | undefined> {
  return queryOne<UniverseMessageRow>(
    db,
    `INSERT INTO universe_messages
       (subject_id, date, mood, prompt, title, subtitle, whisper, affirmation,
        action_guidance, lucky_number, cosmic_energy, celestial_sign, model,
        astronomy)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (subject_id, date, mood, prompt) DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      input.subjectId,
      input.date,
      input.mood,
      input.prompt,
      input.title,
      input.subtitle,
      input.whisper,
      input.affirmation,
      input.actionGuidance,
      input.luckyNumber,
      input.cosmicEnergy,
      input.celestialSign,
      input.model,
      input.astronomy,
    ],
  );
}
