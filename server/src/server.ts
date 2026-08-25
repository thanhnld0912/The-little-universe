/**
 * LOCAL DEVELOPMENT ENTRY POINT ONLY.
 *
 * Production runs on Vercel through `src/vercel.ts`, which exports the Express
 * app without ever calling `listen`. Nothing here may be imported by that path.
 *
 * Modules are loaded dynamically so that a configuration failure can be
 * reported as a readable message instead of a module-evaluation stack trace —
 * a bad `.env` is by far the most common local failure.
 */
function isEnvironmentError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'EnvironmentError';
}

try {
  const { createApp } = await import('./app.js');
  const { env } = await import('./config/env.js');
  const { closePool } = await import('./db/pool.js');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[server] The Little Universe API listening on http://localhost:${env.PORT}`);
    console.log(`[server] env=${env.NODE_ENV}  ai_provider=${env.AI_PROVIDER}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  if (isEnvironmentError(error)) {
    console.error(`\n[server] ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
