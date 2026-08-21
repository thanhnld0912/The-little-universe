import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import { requireUserId } from '../middleware/auth.js';
import { sendData } from '../utils/respond.js';

export async function postRegister(req: Request, res: Response): Promise<void> {
  // Already validated and normalised by `validateBody(registerSchema)`.
  const result = await authService.register(req.body as RegisterInput);
  sendData(res, result, 201);
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput);
  sendData(res, result);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await authService.getCurrentUser(requireUserId(req));
  sendData(res, { user });
}

/**
 * Logout for stateless JWT authentication.
 *
 * There is no server-side session to destroy, and no token blacklist: a
 * blacklist is a session store wearing a different hat, and would need shared
 * storage that this MVP does not otherwise require. The client discards the
 * token; it then satisfies nobody, and expires on its own regardless.
 *
 * The endpoint exists so the frontend has one obvious call to make, and so a
 * future revocation mechanism has somewhere to live.
 */
export function postLogout(_req: Request, res: Response): void {
  sendData(res, {
    message: 'Signed out. Please discard the stored token.',
  });
}
