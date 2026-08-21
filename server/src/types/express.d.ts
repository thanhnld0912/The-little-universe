/**
 * Request augmentation for authenticated requests.
 *
 * `auth` is optional because most of this API is deliberately reachable
 * without an account. `requireAuth` narrows it for the handlers behind it.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}

export {};
