import { randomInt } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { withTransaction } from '../db/query.js';
import {
  attachReadingToDrawCard,
  findAllCardIds,
  findAllCards,
  findCardById,
  findDrawById,
  findDrawCards,
  findDrawsForUser,
  findReadingById,
  insertDraw,
  insertDrawCard,
  insertReading,
  lockDrawCard,
  type TarotCardRow,
  type TarotDrawCardRow,
  type TarotDrawRow,
  type TarotReadingRow,
} from '../repositories/tarot.repository.js';
import { generateValidated, getAIProvider } from './ai/index.js';
import type { AIProvider } from './ai/AIProvider.js';
import { tarotReadingDraftSchema } from './ai/schemas.js';
import { buildTarotPrompt } from './ai/prompts.js';
import { buildAstronomyContext } from './astronomy/index.js';
import { currentAppDate } from '../utils/dates.js';
import { AppError } from '../utils/errors.js';

/** The only spread this version serves. */
export const SINGLE_SPREAD = 'single';

/** How long a drawn-but-uninterpreted card stays redeemable. */
const DRAW_TTL_MS = 24 * 60 * 60 * 1000;

const POSITION_NAMES = ['CARD I', 'CARD II', 'CARD III'] as const;

export type Orientation = 'upright' | 'reversed';

// --- response shapes ---------------------------------------------------------

export interface TarotCardDto {
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
  imageUrl: string | null;
}

export interface DrawnCardDto {
  position: number;
  positionName: string;
  orientation: Orientation;
  /** The meaning for the orientation actually drawn. */
  meaning: string;
  card: TarotCardDto;
}

export interface DrawDto {
  drawId: string;
  spread: string;
  question: string | null;
  createdAt: string;
  expiresAt: string;
  interpreted: boolean;
  cards: DrawnCardDto[];
}

export interface TarotReadingDto {
  title: string;
  summary: string;
  interpretation: string;
  guidance: string;
  reflectionQuestion: string;
}

export interface InterpretedDrawDto extends DrawDto {
  reading: TarotReadingDto;
}

// --- mapping -----------------------------------------------------------------

/**
 * The public view of a card.
 *
 * `upright_meaning` and `reversed_meaning` are NOT both exposed on a drawn
 * card: only the one matching the orientation the server chose is returned, so
 * the response cannot be read as an offer of alternatives.
 */
function toCardDto(row: TarotCardRow): TarotCardDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    arcana: row.arcana,
    suit: row.suit,
    number: row.number,
    numeral: row.numeral,
    archetype: row.archetype,
    keywords: row.keywords,
    element: row.element,
    imageUrl: row.image_url,
  };
}

function meaningFor(card: TarotCardRow, orientation: Orientation): string {
  // Selected by the BACKEND. The model is never asked which meaning applies.
  return orientation === 'upright' ? card.upright_meaning : card.reversed_meaning;
}

function toReadingDto(row: TarotReadingRow): TarotReadingDto {
  // Stored as validated JSONB; re-validated on the way out so a hand-edited
  // row cannot produce a malformed response.
  const parsed = tarotReadingDraftSchema.safeParse(row.interpretation);
  if (!parsed.success) {
    console.error(`[tarot] reading ${row.id} has malformed stored interpretation`);
    throw AppError.upstream('This reading could not be read back. Please draw again.');
  }
  return parsed.data;
}

// --- deck --------------------------------------------------------------------

export async function listCards(): Promise<TarotCardDto[]> {
  const rows = await findAllCards(getPool());
  return rows.map(toCardDto);
}

// --- drawing -----------------------------------------------------------------

/**
 * Chooses `count` distinct cards using cryptographically secure randomness.
 *
 * A partial Fisher-Yates over the id list: each step swaps a securely chosen
 * remaining element into place, which is unbiased and cannot repeat a card.
 * `Math.random()` is unsuitable here and is never used — it is seeded
 * predictably and its output is not uniform enough to be relied on for
 * anything a user might feel is fair.
 */
export function selectCardIds(ids: readonly string[], count: number): string[] {
  if (count > ids.length) {
    throw new Error(`Cannot draw ${count} cards from a deck of ${ids.length}.`);
  }
  const pool = [...ids];
  const chosen: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const pick = randomInt(index, pool.length);
    const swap = pool[index] as string;
    pool[index] = pool[pick] as string;
    pool[pick] = swap;
    chosen.push(pool[index] as string);
  }
  return chosen;
}

/** An unbiased, cryptographically secure coin flip. */
export function selectOrientation(): Orientation {
  return randomInt(0, 2) === 0 ? 'upright' : 'reversed';
}

export interface DrawOptions {
  userId: string | null;
  question: string | null;
  now?: Date;
}

/**
 * Performs a single-card draw.
 *
 * The card and its orientation are chosen here and WRITTEN DOWN before the
 * response is produced. Everything the client later does refers to the stored
 * decision by id.
 */
export async function drawSingleCard(options: DrawOptions): Promise<DrawDto> {
  const now = options.now ?? new Date();
  const ids = await findAllCardIds(getPool());

  if (ids.length === 0) {
    throw AppError.upstream('The deck is not available right now.');
  }

  const [cardId] = selectCardIds(ids, 1);
  if (!cardId) throw new Error('Card selection produced nothing.');
  const orientation = selectOrientation();

  // Draw and card commit together: a draw with no card could never be
  // interpreted and would be an invisible dead row.
  const { draw, drawCard } = await withTransaction(async (client) => {
    const created = await insertDraw(client, {
      userId: options.userId,
      spread: SINGLE_SPREAD,
      question: options.question,
      expiresAt: new Date(now.getTime() + DRAW_TTL_MS),
    });
    const card = await insertDrawCard(client, {
      drawId: created.id,
      cardId,
      position: 0,
      positionName: POSITION_NAMES[0],
      orientation,
    });
    return { draw: created, drawCard: card };
  });

  const card = await findCardById(getPool(), cardId);
  if (!card) throw new Error(`Drawn card ${cardId} could not be loaded.`);

  return toDrawDto(draw, [{ drawCard, card }]);
}

function toDrawDto(
  draw: TarotDrawRow,
  cards: { drawCard: TarotDrawCardRow; card: TarotCardRow }[],
): DrawDto {
  return {
    drawId: draw.id,
    spread: draw.spread,
    question: draw.question,
    createdAt: draw.created_at.toISOString(),
    expiresAt: draw.expires_at.toISOString(),
    interpreted: cards.every((entry) => entry.drawCard.reading_id !== null),
    cards: cards.map(({ drawCard, card }) => {
      const orientation = drawCard.orientation as Orientation;
      return {
        position: drawCard.position,
        positionName: drawCard.position_name,
        orientation,
        meaning: meaningFor(card, orientation),
        card: toCardDto(card),
      };
    }),
  };
}

// --- loading a draw ----------------------------------------------------------

interface LoadedDraw {
  draw: TarotDrawRow;
  drawCard: TarotDrawCardRow;
  card: TarotCardRow;
}

/**
 * Loads a draw and enforces who may see it.
 *
 * A draw made while signed in belongs to that account. A request from anyone
 * else is answered with 404 rather than 403: confirming that a draw exists but
 * belongs to someone else is itself a disclosure.
 *
 * An anonymous draw (`user_id IS NULL`) is readable by anyone holding its id,
 * which is a 128-bit random uuid and is the only way to reach it.
 */
async function loadDraw(drawId: string, requesterId: string | null): Promise<LoadedDraw> {
  const pool = getPool();

  const draw = await findDrawById(pool, drawId);
  if (!draw) throw AppError.notFound('That reading could not be found.');

  if (draw.user_id !== null && draw.user_id !== requesterId) {
    throw AppError.notFound('That reading could not be found.');
  }

  const cards = await findDrawCards(pool, drawId);
  const drawCard = cards[0];
  if (!drawCard) {
    throw AppError.upstream('That reading is incomplete. Please draw again.');
  }

  const card = await findCardById(pool, drawCard.card_id);
  if (!card) {
    throw AppError.upstream('That reading is incomplete. Please draw again.');
  }

  return { draw, drawCard, card };
}

function assertNotExpired(draw: TarotDrawRow, now: Date): void {
  if (draw.expires_at.getTime() <= now.getTime()) {
    throw new AppError(
      'CONFLICT',
      'This draw has expired. Please draw a new card.',
      409,
    );
  }
}

// --- interpretation ----------------------------------------------------------

export interface InterpretOptions {
  drawId: string;
  requesterId: string | null;
  now?: Date;
  provider?: AIProvider;
}

/**
 * Interprets a draw.
 *
 * The request carries a draw id and nothing else. The card, its orientation
 * and its meaning are all read from what the server stored at draw time, so a
 * client cannot substitute any of them.
 *
 * IDEMPOTENT: once a draw has a reading, that reading is returned and NO
 * further AI generation happens, however many times it is called.
 */
export async function interpretDraw(options: InterpretOptions): Promise<InterpretedDrawDto> {
  const now = options.now ?? new Date();
  const provider = options.provider ?? getAIProvider();
  const pool = getPool();

  const { draw, drawCard, card } = await loadDraw(options.drawId, options.requesterId);

  // Fast path: already interpreted. No lock, no generation.
  if (drawCard.reading_id) {
    const existing = await findReadingById(pool, drawCard.reading_id);
    if (existing) {
      return { ...toDrawDto(draw, [{ drawCard, card }]), reading: toReadingDto(existing) };
    }
  }

  assertNotExpired(draw, now);

  const orientation = drawCard.orientation as Orientation;

  // Deterministic context first. The orientation-specific meaning is chosen
  // HERE, so the model is told which meaning applies rather than deciding.
  const astronomy = buildAstronomyContext(currentAppDate(now));
  const prompt = buildTarotPrompt({
    card: {
      name: card.name,
      arcana: card.arcana,
      suit: card.suit,
      numeral: card.numeral,
      archetype: card.archetype,
      keywords: card.keywords,
      meaning: meaningFor(card, orientation),
    },
    orientation,
    positionName: drawCard.position_name,
    question: draw.question,
    astronomy,
  });

  // Generated OUTSIDE the transaction: an AI call can take seconds, and
  // holding a pooled connection open for that would starve a serverless pool.
  const reading = await generateValidated(
    `tarot:${draw.id}`,
    tarotReadingDraftSchema,
    () =>
      provider.generate({
        task: 'tarot',
        ...prompt,
        seed: `${draw.id}:${card.slug}:${orientation}`,
      }),
  );

  // Short transaction to commit it, with a lock so two concurrent requests
  // cannot both write a reading for the same draw.
  const stored = await withTransaction(async (client) => {
    const locked = await lockDrawCard(client, draw.id, drawCard.position);
    if (!locked) throw AppError.notFound('That reading could not be found.');

    if (locked.reading_id) {
      // Another request won while we were generating. Its reading stands and
      // ours is discarded; the caller must still see one consistent answer.
      const winner = await findReadingById(client, locked.reading_id);
      if (winner) return { row: winner, drawCard: locked };
    }

    const row = await insertReading(client, {
      userId: draw.user_id,
      cardId: card.id,
      question: draw.question,
      position: drawCard.position_name,
      orientation,
      interpretation: reading,
      model: provider.name,
    });
    await attachReadingToDrawCard(client, locked.id, row.id);
    return { row, drawCard: { ...locked, reading_id: row.id } };
  });

  return {
    ...toDrawDto(draw, [{ drawCard: stored.drawCard, card }]),
    reading: toReadingDto(stored.row),
  };
}

// --- history -----------------------------------------------------------------

export interface HistoryEntryDto {
  drawId: string;
  question: string | null;
  createdAt: string;
  interpreted: boolean;
  orientation: Orientation;
  card: { name: string; slug: string; arcana: string; suit: string | null };
}

/** The signed-in user's own draws. Never anyone else's. */
export async function listHistory(userId: string, limit = 20): Promise<HistoryEntryDto[]> {
  const pool = getPool();
  const rows = await findDrawsForUser(pool, userId, limit);

  const entries: HistoryEntryDto[] = [];
  for (const row of rows) {
    const card = await findCardById(pool, row.card_id);
    if (!card) continue;
    entries.push({
      drawId: row.id,
      question: row.question,
      createdAt: row.created_at.toISOString(),
      interpreted: row.reading_id !== null,
      orientation: row.orientation as Orientation,
      card: { name: card.name, slug: card.slug, arcana: card.arcana, suit: card.suit },
    });
  }
  return entries;
}

/**
 * A single past draw, with its reading when it has one.
 *
 * An expired draw is still readable here — expiry blocks NEW interpretation,
 * it does not erase what already happened.
 */
export async function getHistoryEntry(
  drawId: string,
  requesterId: string | null,
): Promise<DrawDto | InterpretedDrawDto> {
  const { draw, drawCard, card } = await loadDraw(drawId, requesterId);
  const base = toDrawDto(draw, [{ drawCard, card }]);

  if (!drawCard.reading_id) return base;

  const reading = await findReadingById(getPool(), drawCard.reading_id);
  if (!reading) return base;

  return { ...base, reading: toReadingDto(reading) };
}
