/**
 * Vercel serverless entry point.
 *
 * Exports the Express app as the request handler. It must NOT call
 * `app.listen()` — Vercel owns the server lifecycle, and a long-running
 * listener here would hold the function open.
 *
 * The app (and therefore the pg pool) is created once per warm instance and
 * reused across invocations.
 */
import { createApp } from '../src/app.js';

const app = createApp();

export default app;
