import type { Request, Response } from 'express';
import { getDailyPrediction, getWeeklyPrediction } from '../services/prediction.service.js';
import { buildDateQuerySchema } from '../schemas/prediction.schema.js';
import { requireSubjectId } from '../middleware/subject.js';
import { currentAppDate } from '../utils/dates.js';
import { sendData } from '../utils/respond.js';

/**
 * Resolves the date a request is asking about.
 *
 * `today` is computed once per request and passed into the schema, so the
 * validity window is evaluated against a single instant rather than drifting
 * between checks.
 */
function resolveDate(req: Request): string {
  const today = currentAppDate();
  const query = buildDateQuerySchema(today).parse(req.query);
  return query.date ?? today;
}

/**
 * GET /api/predictions/daily[?date=YYYY-MM-DD]
 *
 * Reads the caller's stored reading for the date, generating one only the first
 * time this caller ever requests that date. This is also what the UI's refresh
 * control calls: it re-fetches, it does not regenerate.
 */
export async function getDaily(req: Request, res: Response): Promise<void> {
  const data = await getDailyPrediction(resolveDate(req), requireSubjectId(req));
  sendData(res, data);
}

/**
 * GET /api/predictions/weekly[?date=YYYY-MM-DD]
 *
 * `date` selects a week by any day inside it; the service normalises to that
 * ISO week's Monday. Always returns exactly seven consecutive days.
 */
export async function getWeekly(req: Request, res: Response): Promise<void> {
  const data = await getWeeklyPrediction(resolveDate(req), requireSubjectId(req));
  sendData(res, data);
}
