import type { Request, Response } from 'express';
import { createUniverseMessage } from '../services/message.service.js';
import type { MessageRequest } from '../schemas/message.schema.js';
import { requireSubjectId } from '../middleware/subject.js';
import { currentAppDate } from '../utils/dates.js';
import { sendData } from '../utils/respond.js';

/**
 * POST /api/messages
 *
 * Writes a message for the mood the caller chose, and for their own words when
 * they wrote any. The date is the application's, never the client's: a message
 * is about today, and letting a caller name the day would let them mint
 * unlimited distinct rows.
 *
 * Idempotent. Asking the same thing twice returns the first message and
 * generates nothing, so a double-tap costs one generation rather than two.
 * That is why it answers 200 rather than 201 — the second call created nothing.
 */
export async function postMessage(req: Request, res: Response): Promise<void> {
  const body = req.body as MessageRequest;

  const message = await createUniverseMessage({
    subjectId: requireSubjectId(req),
    date: currentAppDate(),
    mood: body.mood,
    // '' is the stored form of "wrote nothing"; see migration 006 for why it is
    // not NULL.
    prompt: body.prompt ?? '',
  });

  sendData(res, message);
}
