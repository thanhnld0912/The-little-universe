import { z } from 'zod';

/**
 * Draw request.
 *
 * A question is optional. Note what is NOT accepted and never will be: a card
 * id, a card name, a suit, or an orientation. `strictObject` means a client
 * sending `{ cardId: "..." }` is REJECTED outright rather than having the
 * field quietly ignored — a rejection is visible in testing, a silent drop is
 * not.
 */
export const drawRequestSchema = z.strictObject({
  question: z
    .string()
    .trim()
    .min(1, 'A question cannot be empty. Leave it out instead.')
    .max(300, 'Please keep the question under 300 characters.')
    .optional(),
});

/**
 * Interpret request. The draw id and nothing else: everything about the card
 * is read from what the server persisted at draw time.
 */
export const interpretRequestSchema = z.strictObject({
  drawId: z.uuid('drawId must be a valid draw identifier.'),
});

export type DrawRequest = z.infer<typeof drawRequestSchema>;
export type InterpretRequest = z.infer<typeof interpretRequestSchema>;
