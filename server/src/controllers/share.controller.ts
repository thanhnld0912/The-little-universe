import type { Request, Response } from 'express';
import { createShare, getShare } from '../services/share.service.js';
import type { ShareRequest } from '../schemas/share.schema.js';
import { requireSubjectId } from '../middleware/subject.js';
import { currentAppDate } from '../utils/dates.js';
import { sendData } from '../utils/respond.js';

/**
 * POST /api/shares
 *
 * Creates a link. The body names WHICH of the caller's own readings to share,
 * or carries the words of a secret message; it never carries the content of a
 * reading, which the server builds from what it already stored.
 *
 * 201, because this genuinely creates something new every time. Unlike the
 * readings, a share is not idempotent: asking twice is two links, which is what
 * someone sending the same reading to two people expects.
 */
export async function postShare(req: Request, res: Response): Promise<void> {
  const body = req.body as ShareRequest;

  const created = await createShare({
    subjectId: requireSubjectId(req),
    // The application's date, never the client's — the same rule as everywhere
    // else, so a caller cannot name the day whose reading it shares.
    date: currentAppDate(),
    request: body,
  });

  sendData(res, created, 201);
}

/**
 * GET /api/shares/:slug
 *
 * Public and unauthenticated on purpose: a share is for someone who is not the
 * sender, and requiring an account would defeat it. The slug is the credential.
 */
export async function getShareBySlug(req: Request, res: Response): Promise<void> {
  const slug = req.params['slug'] ?? '';
  sendData(res, await getShare(slug));
}
