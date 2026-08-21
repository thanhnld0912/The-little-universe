import type { NextFunction, Request, Response } from 'express';
import { extractBearerToken, verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

/**
 * Requires a valid bearer token.
 *
 * Attaches only the user id. No database read happens here, so the common case
 * costs nothing; handlers that need the account load it themselves, which also
 * keeps them honest about an account that has since been deleted.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw AppError.unauthorized('Please sign in to continue.');
    }
    req.auth = { userId: verifyAccessToken(token).sub };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Associates a request with an account when one is offered, without requiring
 * it. Daily readings, the weekly forecast, tarot and the written message are
 * all explorable with no account at all; signing in only adds history and
 * personalisation.
 *
 * Note the asymmetry, which is deliberate:
 *
 *   no Authorization header        -> anonymous, continue
 *   present and valid              -> identified, continue
 *   present and invalid or expired -> 401, do NOT continue
 *
 * The last case could be treated as anonymous, but that would silently
 * downgrade a signed-in user whose token has just expired: their readings
 * would quietly stop being saved with no indication anything was wrong.
 * Failing loudly lets the client discard the dead token and retry.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
      req.auth = { userId: verifyAccessToken(token).sub };
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Reads the authenticated user id inside a `requireAuth` handler.
 * Throws rather than returning undefined, so a route that forgot the
 * middleware fails immediately instead of silently acting as another user.
 */
export function requireUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw AppError.unauthorized('Please sign in to continue.');
  }
  return userId;
}
