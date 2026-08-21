import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendError } from '../utils/respond.js';
import { isProduction } from '../config/env.js';

/** Turns a ZodError into `{ "field.path": ["message", ...] }`. */
function formatZodIssues(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    const bucket = details[key];
    if (bucket) bucket.push(issue.message);
    else details[key] = [issue.message];
  }
  return details;
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, ErrorCode.NOT_FOUND, `No route matches ${req.method} ${req.path}`, 404);
}

/**
 * The single place an error becomes an HTTP response.
 *
 * FAIL CLOSED (Lumiere lesson §6): only errors we explicitly recognise get a
 * descriptive message. Everything else — raw `pg` errors, `TypeError`,
 * `ECONNREFUSED`, anything a dependency throws — falls into the default branch
 * and is reported as a generic 500. That is what keeps SQL text, connection
 * strings, file paths and stack traces out of client responses.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.code, error.message, error.status, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendError(res, ErrorCode.VALIDATION_ERROR, 'Invalid request.', 400, formatZodIssues(error));
    return;
  }

  // Body parser rejects malformed JSON with a SyntaxError carrying `status`.
  if (error instanceof SyntaxError && 'body' in error) {
    sendError(res, ErrorCode.VALIDATION_ERROR, 'Request body is not valid JSON.', 400);
    return;
  }

  // --- default branch: untrusted --------------------------------------------
  // Log everything we know server-side...
  console.error('[error] unhandled:', error);

  // ...and tell the client nothing beyond the fact that it failed.
  // Outside production the stack is included to make local debugging bearable.
  const details =
    isProduction || !(error instanceof Error) ? undefined : { stack: error.stack?.split('\n') };

  sendError(res, ErrorCode.INTERNAL_ERROR, 'Something went wrong on our side.', 500, details);
}
