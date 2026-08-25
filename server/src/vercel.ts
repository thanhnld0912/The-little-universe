/**
 * Vercel serverless entry point (source).
 *
 * Exports the Express app as the request handler. It must NOT call
 * `app.listen()` — Vercel owns the server lifecycle, and a long-running
 * listener here would hold the function open.
 *
 * The app (and therefore the pg pool) is created once per warm instance and
 * reused across invocations.
 *
 * This file is the entry point for `scripts/bundle.mjs`, which compiles it and
 * every dependency into a single self-contained module at
 * `dist/vercel/index.js`. `api/index.js` — the file Vercel actually detects as
 * a function — re-exports that bundle. See scripts/bundle.mjs for why.
 */
import { createApp } from './app.js';

const app = createApp();

export default app;
