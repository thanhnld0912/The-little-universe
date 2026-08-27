import { z } from 'zod';

/**
 * What a caller may ask to share.
 *
 * A DISCRIMINATED UNION rather than one object with optional fields, so each
 * kind carries exactly what it needs and nothing it does not. `{ kind:
 * 'daily', drawId: '...' }` is rejected rather than having the stray field
 * ignored, and `{ kind: 'tarot' }` cannot arrive without the draw it refers to.
 *
 * Note what is absent from every branch: the CONTENT. There is no `title`, no
 * `whisper`, no `payload`. The server builds the snapshot from what it already
 * stored, because a client that could supply the text of a share could publish
 * anything it liked on this domain under the app's name.
 *
 * `secret` is the one exception, and it is explicit: `note` is the sender's own
 * words, is stored in its own column, and is presented to the reader as a
 * message from a person rather than as a reading.
 */
export const shareRequestSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('daily') }),
  z.strictObject({ kind: z.literal('weekly') }),
  z.strictObject({
    kind: z.literal('tarot'),
    drawId: z.uuid('drawId must be a valid draw identifier.'),
  }),
  z.strictObject({
    kind: z.literal('message'),
    messageId: z.uuid('messageId must be a valid message identifier.'),
  }),
  z.strictObject({
    kind: z.literal('secret'),
    note: z
      .string()
      .trim()
      .min(1, 'A secret message cannot be empty.')
      .max(500, 'Please keep it under 500 characters.'),
  }),
]);

export type ShareRequest = z.infer<typeof shareRequestSchema>;
