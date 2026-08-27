import { Router, type NextFunction, type Request, type Response } from 'express';
import { getDaily, getWeekly } from '../controllers/prediction.controller.js';
import { optionalAuth } from '../middleware/auth.js';
import { resolveSubject } from '../middleware/subject.js';

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export const predictionRoutes: Router = Router();

// Readings are explorable without an account. `optionalAuth` associates a
// request with a user when a token is offered, which later phases use for
// history, and rejects a token that is present but invalid rather than
// silently downgrading the caller to anonymous.
//
// `resolveSubject` must come after it: a signed-in caller is keyed to their
// account, so their readings follow them between devices, and everyone else
// gets a visitor cookie so their readings are still their own.
predictionRoutes.get('/daily', optionalAuth, resolveSubject, asyncRoute(getDaily));
predictionRoutes.get('/weekly', optionalAuth, resolveSubject, asyncRoute(getWeekly));
