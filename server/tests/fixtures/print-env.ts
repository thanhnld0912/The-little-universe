/**
 * Child-process fixture for the environment tests.
 *
 * Prints the resolved configuration as one JSON line prefixed with `RESULT `,
 * or the validation failure as one line prefixed with `ENV_ERROR `.
 *
 * This MUST be a separate process: `src/config/env.ts` reads `process.env`
 * exactly once, when it is first imported. Mutating `process.env` inside an
 * already-running test process would prove nothing.
 */
async function main(): Promise<void> {
  try {
    const { env } = await import('../../src/config/env.js');
    const { DATABASE_URL: _url, JWT_SECRET: _secret, ...safe } = env;
    console.log(`RESULT ${JSON.stringify(safe)}`);
  } catch (error) {
    if (error instanceof Error && error.name === 'EnvironmentError') {
      console.log(`ENV_ERROR ${JSON.stringify(error.message)}`);
      process.exit(1);
    }
    throw error;
  }
}

await main();
