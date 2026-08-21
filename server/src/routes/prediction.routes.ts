import { Router, type NextFunction, type Request, type Response } from 'express';
import { getDaily, getWeekly } from '../controllers/prediction.controller.js';
import { optionalAuth } from '../middleware/auth.js';

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
predictionRoutes.get('/daily', optionalAuth, asyncRoute(getDaily));
predictionRoutes.get('/weekly', optionalAuth, asyncRoute(getWeekly));
