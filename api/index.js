/**
 * Vercel serverless function entry for the whole deployment.
 *
 * Vercel only discovers functions from files inside the `api/` directory of the
 * project's Root Directory. It does NOT execute arbitrary files under
 * `server/dist/`. This file is therefore the one thing Vercel sees; the actual
 * Express application is the self-contained bundle it re-exports.
 *
 * It is deliberately plain JavaScript with a single relative import, so Vercel's
 * Node builder has no TypeScript to compile and no package to resolve here. The
 * bundle it points at is produced by `npm run build` (see
 * server/scripts/bundle.mjs) and already contains every dependency, so nothing
 * is resolved at deploy time or at runtime.
 *
 * This file must stay committed rather than generated: Vercel decides which
 * functions exist from the repository contents, not only from build output.
 *
 * Routing: `vercel.json` rewrites `/api/(.*)` here, so Express receives the
 * original URL (`/api/health`, `/api/tarot/cards`, ...) and matches its own
 * routes. Everything else falls through to the static Vite build in `dist/`.
 */
export { default } from '../server/dist/vercel/index.js';
