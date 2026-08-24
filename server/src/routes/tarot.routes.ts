import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  getCards,
  getHistory,
  getHistoryById,
  postDraw,
  postInterpret,
} from '../controllers/tarot.controller.js';
import { drawRequestSchema, interpretRequestSchema } from '../schemas/tarot.schema.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export const tarotRoutes: Router = Router();

tarotRoutes.get('/cards', asyncRoute(getCards));

// Drawing and interpreting work anonymously; a token, when offered, binds the
// draw to that account.
tarotRoutes.post('/draw', optionalAuth, validateBody(drawRequestSchema), asyncRoute(postDraw));
tarotRoutes.post(
  '/interpret',
  optionalAuth,
  validateBody(interpretRequestSchema),
  asyncRoute(postInterpret),
);

// Listing a user's own history necessarily requires an account.
tarotRoutes.get('/history', requireAuth, asyncRoute(getHistory));
// A single draw is reachable by its opaque id; ownership is enforced in the
// service for draws that belong to an account.
tarotRoutes.get('/history/:id', optionalAuth, asyncRoute(getHistoryById));
