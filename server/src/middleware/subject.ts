/**
 * Decides whose reading a request is asking for.
 *
 * Readings used to be keyed by date alone, so every visitor saw the same text.
 * They are now keyed by a "subject": the account when one is signed in, and
 * otherwise an anonymous visitor identified by a cookie this server issues.
 *
 * Why a server-issued cookie rather than a client-generated id: it needs no
 * frontend change, it works for the anonymous visitors who are the majority,
 * and the API and the site now share one origin, so it travels without any
 * CORS credential handling.
 *
 * The visitor id is NOT an authentication mechanism and grants nothing. It
 * decides which cached reading you are shown, nothing more. Anything that
 * requires identity keeps going through `requireAuth`.
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env.js';

export const VISITOR_COOKIE = 'tlu_visitor';

/**
 * 400 days is the maximum a browser will honour (Chrome caps `Max-Age` there),
 * so asking for more would silently become less.
 */
const COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

/**
 * Matches the same shape the database CHECK constraint enforces. A cookie that
 * fails this is replaced rather than trusted, so a hand-edited value cannot
 * become a storage key.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Reads one cookie from the raw header.
 *
 * Express does not parse cookies without `cookie-parser`, and one lookup does
 * not justify another dependency inside the serverless bundle.
 */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      // A malformed percent-encoding is a broken cookie, not a usable id.
      return undefined;
    }
  }

  return undefined;
}

/**
 * Resolves `req.subjectId`, issuing a visitor cookie when there is nothing to
 * identify the caller yet.
 *
 * Must run after `optionalAuth`, so that a signed-in caller is keyed to their
 * account rather than to whichever browser they happen to be using.
 */
export function resolveSubject(req: Request, res: Response, next: NextFunction): void {
  const userId = req.auth?.userId;
  if (userId) {
    req.subjectId = `user:${userId}`;
    next();
    return;
  }

  const existing = readCookie(req.headers.cookie, VISITOR_COOKIE);
  const visitorId = existing && UUID_PATTERN.test(existing) ? existing : randomUUID();

  if (visitorId !== existing) {
    res.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      // Lax still sends the cookie on top-level navigation, which is how
      // someone arrives at the site, while keeping it off cross-site requests.
      sameSite: 'lax',
      secure: isProduction,
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }

  req.subjectId = `visitor:${visitorId}`;
  next();
}

/**
 * Reads the subject inside a handler behind `resolveSubject`.
 *
 * Throws rather than inventing a fallback: a route that forgot the middleware
 * must fail visibly, not quietly write everyone's reading to one shared key
 * again. This is a programming error rather than a caller error, so it is a
 * plain Error — the central handler turns it into a 500 without leaking it.
 */
export function requireSubjectId(req: Request): string {
  const subjectId = req.subjectId;
  if (!subjectId) {
    throw new Error('resolveSubject middleware is missing from this route.');
  }
  return subjectId;
}
