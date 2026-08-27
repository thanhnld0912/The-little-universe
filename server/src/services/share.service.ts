/**
 * Shares: content behind an unguessable link, readable by someone who is not
 * the sender.
 *
 * Two rules shape everything in this file.
 *
 * 1. THE SERVER BUILDS THE SNAPSHOT. A caller names WHICH of its own readings
 *    to share; it never supplies the text. A client that could supply the text
 *    could publish anything on this domain under the app's name, which is a
 *    phishing vector rather than a hypothetical. `note` on a secret message is
 *    the single exception, is stored in its own column, and is presented to the
 *    reader as words from a person.
 *
 * 2. A SNAPSHOT IS TAKEN, NOT A REFERENCE STORED. What was shared is what the
 *    recipient sees, permanently — the underlying reading is keyed to one
 *    subject and one day, and today's row is not what was shared last week.
 */
import { randomBytes } from 'node:crypto';
import { getPool } from '../db/pool.js';
import {
  countRecentShares,
  findShareBySlug,
  insertShare,
  type ShareRow,
} from '../repositories/share.repository.js';
import { findMessageById } from '../repositories/message.repository.js';
import { getDailyPrediction, getWeeklyPrediction } from './prediction.service.js';
import { interpretDraw } from './tarot.service.js';
import { AppError } from '../utils/errors.js';
import type { ShareRequest } from '../schemas/share.schema.js';

/** base64url over 12 random bytes: 16 characters, 96 bits. */
const SLUG_BYTES = 12;

/**
 * A slug is the ONLY thing protecting a share, so it is generated from a
 * cryptographic source and is long enough that guessing is not a strategy.
 * `Math.random` would be the classic way to get this wrong.
 */
function generateSlug(): string {
  return randomBytes(SLUG_BYTES).toString('base64url');
}

/**
 * A cap on how many shares one sender can create in a day.
 *
 * This endpoint mints public URLs on this domain from text a person writes,
 * which is exactly the shape of thing that gets used to host spam. The cap is
 * generous enough that nobody sharing readings will meet it.
 */
const MAX_SHARES_PER_DAY = 30;

export type ShareKind = ShareRequest['kind'];

/** What a reader receives. Note what is NOT here: the sender, and any row id. */
export interface SharedContentDto {
  kind: ShareKind;
  createdAt: string;
  /** The snapshot. Absent for a secret message, which has none. */
  content?: unknown;
  /** The sender's own words. Present only for a secret message. */
  note?: string;
}

export interface CreateShareInput {
  subjectId: string;
  date: string;
  request: ShareRequest;
}

export interface CreatedShareDto {
  slug: string;
  kind: ShareKind;
  createdAt: string;
}

/**
 * Builds the snapshot for a share from what the server already holds.
 *
 * Every branch reads the caller's OWN content: the predictions are looked up by
 * the caller's subject, and the message lookup is scoped to it. A caller cannot
 * name someone else's reading and publish it.
 */
async function buildPayload(input: CreateShareInput): Promise<unknown> {
  const { subjectId, date, request } = input;

  switch (request.kind) {
    case 'daily':
      return getDailyPrediction(date, subjectId);

    case 'weekly':
      return getWeeklyPrediction(date, subjectId);

    case 'tarot': {
      const interpreted = await interpretDraw({
        drawId: request.drawId,
        // A draw bound to an account is readable only by that account. An
        // anonymous draw is reachable by whoever holds its id, which is the
        // person who drew it.
        requesterId: subjectId.startsWith('user:') ? subjectId.slice('user:'.length) : null,
      });

      const card = interpreted.cards[0];
      if (!card) throw AppError.notFound('That reading could not be found.');

      // Explicitly picked, not spread. `drawId` and `expiresAt` are deliberately
      // dropped: a recipient holding a drawId could read the draw directly
      // through the tarot API, and a share does not expire with the draw it was
      // taken from.
      return {
        question: interpreted.question,
        positionName: card.positionName,
        orientation: card.orientation,
        meaning: card.meaning,
        card: {
          name: card.card.name,
          arcana: card.card.arcana,
          numeral: card.card.numeral,
          archetype: card.card.archetype,
          keywords: card.card.keywords,
          element: card.card.element,
        },
        reading: interpreted.reading,
      };
    }

    case 'message': {
      const row = await findMessageById(getPool(), request.messageId, subjectId);
      if (!row) throw AppError.notFound('That message could not be found.');

      // Picked field by field, and the row id is not among them.
      return {
        date: row.date,
        mood: row.mood,
        title: row.title,
        subtitle: row.subtitle,
        celestialSign: row.celestial_sign,
        whisper: row.whisper,
        affirmation: row.affirmation,
        actionGuidance: row.action_guidance,
        luckyNumber: String(row.lucky_number).padStart(2, '0'),
        cosmicEnergy: row.cosmic_energy,
      };
    }

    case 'secret':
      // The note lives in its own column, not in the payload.
      return {};

    default: {
      const exhaustive: never = request;
      throw new Error(`Unsupported share kind: ${String(exhaustive)}`);
    }
  }
}

/** True for the Postgres unique-violation SQLSTATE. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export async function createShare(input: CreateShareInput): Promise<CreatedShareDto> {
  const pool = getPool();

  const recent = await countRecentShares(pool, input.subjectId);
  if (recent >= MAX_SHARES_PER_DAY) {
    throw AppError.rateLimited('You have created a lot of links today. Please try again tomorrow.');
  }

  const payload = await buildPayload(input);
  const note = input.request.kind === 'secret' ? input.request.note : null;

  // A 96-bit collision will not happen; retrying rather than 500-ing costs two
  // lines and means the UNIQUE constraint can never surface as a crash.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await insertShare(pool, {
        slug: generateSlug(),
        kind: input.request.kind,
        subjectId: input.subjectId,
        payload,
        note,
      });
      return { slug: row.slug, kind: row.kind as ShareKind, createdAt: row.created_at.toISOString() };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }

  console.error('[share] could not find a free slug in 3 attempts', lastError);
  throw AppError.upstream('That link could not be created. Please try again.');
}

function toPublic(row: ShareRow): SharedContentDto {
  const dto: SharedContentDto = {
    kind: row.kind as ShareKind,
    createdAt: row.created_at.toISOString(),
  };

  // Empty is not a value: a secret message has no snapshot and a reading has no
  // note, and neither is returned as an empty object or an empty string.
  if (row.kind === 'secret') {
    if (row.note !== null) dto.note = row.note;
  } else {
    dto.content = row.payload;
  }

  return dto;
}

/**
 * Reads a share.
 *
 * No authentication and no subject: a share exists precisely so that a stranger
 * holding the link can read it. What comes back never includes who created it —
 * the sender's identity is not part of what they chose to share.
 */
export async function getShare(slug: string): Promise<SharedContentDto> {
  const row = await findShareBySlug(getPool(), slug);
  // Deliberately the same answer for "never existed" and "malformed slug": a
  // reader learns nothing about which slugs are real.
  if (!row) throw AppError.notFound('That link is not one we recognise.');
  return toPublic(row);
}
