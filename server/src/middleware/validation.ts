import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Validates and REPLACES `req.body` with the parsed result, so handlers work
 * with typed, normalised data (trimmed, lower-cased email, stripped unknown
 * keys) rather than whatever arrived over the wire.
 *
 * Failures are passed to the central error handler, which renders a ZodError
 * as a 400 VALIDATION_ERROR with per-field messages. Nothing is formatted here.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Same, for query strings. */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    // `req.query` has only a getter on Express 5; assigning to a local keeps
    // this working across versions. Handlers read `res.locals.query`.
    _res.locals['query'] = result.data;
    next();
  };
}
