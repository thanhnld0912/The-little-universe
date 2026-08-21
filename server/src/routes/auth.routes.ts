import { Router, type Request, type Response, type NextFunction } from 'express';
import { getMe, postLogin, postLogout, postRegister } from '../controllers/auth.controller.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';

/**
 * Express 4 does not forward a rejected promise from a handler to the error
 * middleware; an unhandled rejection would hang the request instead. This
 * wrapper is the one place that is dealt with.
 */
function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export const authRoutes: Router = Router();

authRoutes.post('/register', validateBody(registerSchema), asyncRoute(postRegister));
authRoutes.post('/login', validateBody(loginSchema), asyncRoute(postLogin));
authRoutes.get('/me', requireAuth, asyncRoute(getMe));
authRoutes.post('/logout', postLogout);
