import { Router, type NextFunction, type Request, type Response } from 'express';
import { postMessage } from '../controllers/message.controller.js';
import { messageRequestSchema } from '../schemas/message.schema.js';
import { optionalAuth } from '../middleware/auth.js';
import { resolveSubject } from '../middleware/subject.js';
import { validateBody } from '../middleware/validation.js';

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export const messageRoutes: Router = Router();

// Messages work without an account. `optionalAuth` binds one to that account
// when a token is offered; `resolveSubject` must follow it so a signed-in
// person's messages follow them between devices, and everyone else still gets
// messages that are their own rather than the whole site's.
messageRoutes.post(
  '/',
  optionalAuth,
  resolveSubject,
  validateBody(messageRequestSchema),
  asyncRoute(postMessage),
);
