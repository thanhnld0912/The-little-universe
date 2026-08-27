/**
 * Personal messages.
 *
 * The same shape as the predictions service, for the same reasons: deterministic
 * facts are calculated first and handed to the model as fact, the model's reply
 * is validated before it can reach the database, and the result is stored so
 * that asking again returns what you were already given rather than quietly
 * rewriting it.
 *
 * What makes a message "yours": the subject is part of both the storage key and
 * the generation seed. Two people choosing the same mood on the same day, with
 * the same words, still receive different messages.
 */
import { getPool } from '../db/pool.js';
import {
  findMessage,
  insertMessageIfAbsent,
  type UniverseMessageRow,
} from '../repositories/message.repository.js';
import { getAIProvider, generateValidated } from './ai/index.js';
import type { AIProvider } from './ai/AIProvider.js';
import { buildMessagePrompt } from './ai/prompts.js';
import { universeMessageDraftSchema, type MessageMood } from './ai/schemas.js';
import { buildAstronomyContext } from './astronomy/index.js';
import { AppError } from '../utils/errors.js';

export interface UniverseMessageDto {
  id: string;
  date: string;
  mood: string;
  /** Omitted entirely when they wrote nothing — never returned as ''. */
  userPrompt?: string;
  title: string;
  subtitle: string;
  celestialSign: string;
  whisper: string;
  affirmation: string;
  actionGuidance: string;
  /** Two digits, as the view renders it. */
  luckyNumber: string;
  cosmicEnergy: string;
}

function toDto(row: UniverseMessageRow): UniverseMessageDto {
  const dto: UniverseMessageDto = {
    id: row.id,
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

  // Empty is not a value. An absent prompt is an absent field, not '' — a
  // client checking truthiness on '' would render an empty quotation.
  if (row.prompt !== '') dto.userPrompt = row.prompt;

  return dto;
}

/**
 * The sign the message is written under.
 *
 * Calculated, not generated. The Moon's sign is a fact about the sky on that
 * date and is identical for everyone; only the message written under it differs.
 * No houses, ascendant or chart — those are deliberately outside this app.
 */
function celestialSignFor(moonSign: string, moonPhaseName: string): string {
  return `Moon in ${moonSign} • ${moonPhaseName}`;
}

export interface CreateMessageInput {
  subjectId: string;
  date: string;
  mood: MessageMood;
  /** Already trimmed by validation. '' means they wrote nothing. */
  prompt: string;
}

/**
 * Returns the message for this exact request, generating it only if this
 * subject has not already asked for it today.
 *
 * Idempotent by (subject, date, mood, prompt): tapping the button twice costs
 * one generation, not two.
 */
export async function createUniverseMessage(
  input: CreateMessageInput,
  provider: AIProvider = getAIProvider(),
): Promise<UniverseMessageDto> {
  const { subjectId, date, mood, prompt } = input;
  const pool = getPool();

  const existing = await findMessage(pool, subjectId, date, mood, prompt);
  if (existing) return toDto(existing);

  // Deterministic facts FIRST. The model is told what the sky is doing; it is
  // never asked to work it out, and never asked for the sign it writes under.
  const astronomy = buildAstronomyContext(date);
  const promptPair = buildMessagePrompt({
    mood,
    prompt: prompt === '' ? null : prompt,
    astronomy,
  });

  // The seed carries everything that should make two messages differ: who is
  // asking, when, the mood they chose and their own words.
  const seed = `${date}:${subjectId}:${mood}:${prompt}`;

  const draft = await generateValidated(
    `message:${date}:${subjectId}`,
    universeMessageDraftSchema,
    () => provider.generate({ task: 'message', ...promptPair, seed }),
  );

  const inserted = await insertMessageIfAbsent(pool, {
    subjectId,
    date,
    mood,
    prompt,
    title: draft.title,
    subtitle: draft.subtitle,
    whisper: draft.whisper,
    affirmation: draft.affirmation,
    actionGuidance: draft.actionGuidance,
    luckyNumber: draft.luckyNumber,
    cosmicEnergy: draft.cosmicEnergy,
    celestialSign: celestialSignFor(astronomy.moonSign, astronomy.moonPhaseName),
    model: provider.name,
    astronomy,
  });

  if (inserted) return toDto(inserted);

  // Another request for this same message won the race. Its row wins and ours
  // is discarded, so the person sees one message rather than two.
  const winner = await findMessage(pool, subjectId, date, mood, prompt);
  if (!winner) {
    throw AppError.upstream('Your message could not be saved. Please try again.');
  }
  return toDto(winner);
}
