import { z } from 'zod';
import { MESSAGE_MOODS } from '../services/ai/schemas.js';

/**
 * Message request.
 *
 * `strictObject` means a client sending anything else — a title, a whisper, a
 * subject id of its own — is REJECTED outright rather than having the field
 * quietly ignored. A rejection is visible in testing; a silent drop is not. In
 * particular the message content is written by the server and can never be
 * supplied by the caller.
 *
 * The mood is a closed set, matched by a CHECK constraint in the database, so
 * an unrecognised value cannot be stored and later fail to render.
 *
 * The 200-character limit matches what the view's counter allows and what the
 * database CHECK enforces, so all three agree.
 */
export const messageRequestSchema = z.strictObject({
  mood: z.enum(MESSAGE_MOODS, {
    message: `mood must be one of: ${MESSAGE_MOODS.join(', ')}.`,
  }),
  prompt: z
    .string()
    .trim()
    .min(1, 'A note cannot be empty. Leave it out instead.')
    .max(200, 'Please keep your note under 200 characters.')
    .optional(),
});

export type MessageRequest = z.infer<typeof messageRequestSchema>;
