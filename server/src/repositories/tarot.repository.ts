import type { Queryable } from '../db/query.js';
import { queryAll, queryOne } from '../db/query.js';

export interface TarotCardRow {
  id: string;
  slug: string;
  name: string;
  arcana: string;
  suit: string | null;
  number: number | null;
  numeral: string | null;
  archetype: string;
  keywords: string[];
  element: string | null;
  upright_meaning: string;
  reversed_meaning: string;
  image_url: string | null;
}

export interface TarotDrawRow {
  id: string;
  user_id: string | null;
  spread: string;
  question: string | null;
  created_at: Date;
  expires_at: Date;
}

/** A drawn card joined to the card it refers to. */
export interface TarotDrawCardRow {
  id: string;
  draw_id: string;
  card_id: string;
  position: number;
  position_name: string;
  orientation: string;
  reading_id: string | null;
}

export interface TarotReadingRow {
  id: string;
  user_id: string | null;
  card_id: string;
  question: string | null;
  position: string | null;
  orientation: string;
  interpretation: unknown;
  model: string;
  created_at: Date;
}

const CARD_COLUMNS = `
  id, slug, name, arcana, suit, number, numeral, archetype, keywords, element,
  upright_meaning, reversed_meaning, image_url
`;

const DRAW_COLUMNS = 'id, user_id, spread, question, created_at, expires_at';

const DRAW_CARD_COLUMNS = `
  id, draw_id, card_id, position, position_name, orientation, reading_id
`;

const READING_COLUMNS = `
  id, user_id, card_id, question, position, orientation, interpretation, model,
  created_at
`;

// --- cards -----------------------------------------------------------------

export async function findAllCards(db: Queryable): Promise<TarotCardRow[]> {
  return queryAll<TarotCardRow>(
    db,
    `SELECT ${CARD_COLUMNS} FROM tarot_cards
      ORDER BY arcana DESC, suit NULLS FIRST, number`,
  );
}

export async function countCards(db: Queryable): Promise<number> {
  const row = await queryOne<{ count: string }>(db, 'SELECT count(*)::text AS count FROM tarot_cards');
  return Number(row?.count ?? 0);
}

/**
 * Returns every card id, ordered, so the service can sample from the full deck.
 *
 * Ids only: selecting the whole deck to draw one card would move roughly 80 KB
 * of prose per draw for no reason.
 */
export async function findAllCardIds(db: Queryable): Promise<string[]> {
  const rows = await queryAll<{ id: string }>(db, 'SELECT id FROM tarot_cards ORDER BY id');
  return rows.map((row) => row.id);
}

export async function findCardById(
  db: Queryable,
  id: string,
): Promise<TarotCardRow | undefined> {
  return queryOne<TarotCardRow>(db, `SELECT ${CARD_COLUMNS} FROM tarot_cards WHERE id = $1`, [id]);
}

// --- draws -----------------------------------------------------------------

export interface InsertDrawInput {
  userId: string | null;
  spread: string;
  question: string | null;
  expiresAt: Date;
}

export async function insertDraw(db: Queryable, input: InsertDrawInput): Promise<TarotDrawRow> {
  const row = await queryOne<TarotDrawRow>(
    db,
    `INSERT INTO tarot_draws (user_id, spread, question, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING ${DRAW_COLUMNS}`,
    [input.userId, input.spread, input.question, input.expiresAt],
  );
  if (!row) throw new Error('Draw insert returned no row.');
  return row;
}

export interface InsertDrawCardInput {
  drawId: string;
  cardId: string;
  position: number;
  positionName: string;
  orientation: string;
}

export async function insertDrawCard(
  db: Queryable,
  input: InsertDrawCardInput,
): Promise<TarotDrawCardRow> {
  const row = await queryOne<TarotDrawCardRow>(
    db,
    `INSERT INTO tarot_draw_cards (draw_id, card_id, position, position_name, orientation)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${DRAW_CARD_COLUMNS}`,
    [input.drawId, input.cardId, input.position, input.positionName, input.orientation],
  );
  if (!row) throw new Error('Draw card insert returned no row.');
  return row;
}

export async function findDrawById(db: Queryable, id: string): Promise<TarotDrawRow | undefined> {
  return queryOne<TarotDrawRow>(db, `SELECT ${DRAW_COLUMNS} FROM tarot_draws WHERE id = $1`, [id]);
}

export async function findDrawCards(db: Queryable, drawId: string): Promise<TarotDrawCardRow[]> {
  return queryAll<TarotDrawCardRow>(
    db,
    `SELECT ${DRAW_CARD_COLUMNS} FROM tarot_draw_cards WHERE draw_id = $1 ORDER BY position`,
    [drawId],
  );
}

/**
 * Locks the drawn card row for the duration of the caller's transaction.
 *
 * This is what makes interpretation idempotent under concurrency: two requests
 * arriving together both find `reading_id` empty, but only one can hold the
 * lock, and the second re-reads a now-populated value instead of writing a
 * second reading.
 */
export async function lockDrawCard(
  db: Queryable,
  drawId: string,
  position: number,
): Promise<TarotDrawCardRow | undefined> {
  return queryOne<TarotDrawCardRow>(
    db,
    `SELECT ${DRAW_CARD_COLUMNS} FROM tarot_draw_cards
      WHERE draw_id = $1 AND position = $2
      FOR UPDATE`,
    [drawId, position],
  );
}

export async function attachReadingToDrawCard(
  db: Queryable,
  drawCardId: string,
  readingId: string,
): Promise<void> {
  await db.query('UPDATE tarot_draw_cards SET reading_id = $1 WHERE id = $2', [
    readingId,
    drawCardId,
  ]);
}

// --- readings ---------------------------------------------------------------

export interface InsertReadingInput {
  userId: string | null;
  cardId: string;
  question: string | null;
  position: string;
  orientation: string;
  interpretation: unknown;
  model: string;
}

export async function insertReading(
  db: Queryable,
  input: InsertReadingInput,
): Promise<TarotReadingRow> {
  const row = await queryOne<TarotReadingRow>(
    db,
    `INSERT INTO tarot_readings
       (user_id, card_id, question, position, orientation, interpretation, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${READING_COLUMNS}`,
    [
      input.userId,
      input.cardId,
      input.question,
      input.position,
      input.orientation,
      JSON.stringify(input.interpretation),
      input.model,
    ],
  );
  if (!row) throw new Error('Reading insert returned no row.');
  return row;
}

export async function findReadingById(
  db: Queryable,
  id: string,
): Promise<TarotReadingRow | undefined> {
  return queryOne<TarotReadingRow>(
    db,
    `SELECT ${READING_COLUMNS} FROM tarot_readings WHERE id = $1`,
    [id],
  );
}

/** A draw plus its single card and that card's reading, for history listings. */
export interface DrawHistoryRow extends TarotDrawRow {
  card_id: string;
  position: number;
  position_name: string;
  orientation: string;
  reading_id: string | null;
}

export async function findDrawsForUser(
  db: Queryable,
  userId: string,
  limit: number,
): Promise<DrawHistoryRow[]> {
  return queryAll<DrawHistoryRow>(
    db,
    `SELECT d.id, d.user_id, d.spread, d.question, d.created_at, d.expires_at,
            c.card_id, c.position, c.position_name, c.orientation, c.reading_id
       FROM tarot_draws d
       JOIN tarot_draw_cards c ON c.draw_id = d.id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2`,
    [userId, limit],
  );
}
