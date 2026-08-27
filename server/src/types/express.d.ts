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

      /**
       * Whose reading this request is for: `user:<uuid>` or `visitor:<uuid>`.
       * Set by `resolveSubject`; optional because most routes do not need it.
       */
      subjectId?: string;
    }
  }
}

export {};
