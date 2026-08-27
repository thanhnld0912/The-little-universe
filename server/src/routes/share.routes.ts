import { Router, type NextFunction, type Request, type Response } from 'express';
import { getShareBySlug, postShare } from '../controllers/share.controller.js';
import { shareRequestSchema } from '../schemas/share.schema.js';
import { optionalAuth } from '../middleware/auth.js';
import { resolveSubject } from '../middleware/subject.js';
import { validateBody } from '../middleware/validation.js';

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export const shareRoutes: Router = Router();

// Creating needs to know WHOSE reading is being shared, so the subject is
// resolved exactly as it is for readings and messages. Anonymous visitors can
// share; a token simply binds the share to that account instead.
shareRoutes.post(
  '/',
  optionalAuth,
  resolveSubject,
  validateBody(shareRequestSchema),
  asyncRoute(postShare),
);

// Reading takes NO auth and NO subject middleware, deliberately. A share is for
// a stranger holding the link, and `resolveSubject` here would set a visitor
// cookie on someone who has done nothing but open a link — quietly enrolling
// every recipient as a tracked visitor of a site they may never use.
shareRoutes.get('/:slug', asyncRoute(getShareBySlug));
