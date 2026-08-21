/**
 * Environment validation regression tests.
 *
 * Every case here corresponds to a failure that was actually observed and
 * measured in the previous Lumiere project (see lesson.md section 11), not to
 * a hypothetical one:
 *
 *   F1  an unset variable arriving as ""  ->  `.min(1).optional()` rejects it
 *       and the process dies at boot.               (loud)
 *   F5  an unset variable arriving as ""  ->  `z.coerce.number()` turns it
 *       into 0, silently disabling a limit.         (silent, and worse)
 *
 * Each case runs in its own child process because `src/config/env.ts` reads
 * `process.env` once, at import time.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SERVER_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIXTURE = path.join(SERVER_ROOT, 'tests', 'fixtures', 'print-env.ts');

const VALID_BASE: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/tlu',
  JWT_SECRET: 'a'.repeat(32),
  CORS_ORIGIN: 'http://localhost:3000',
  AI_PROVIDER: 'mock',
};

interface LoadResult {
  ok: boolean;
  config: Record<string, unknown>;
  message: string;
}

/** Boots `src/config/env.ts` in a clean child process with exactly `vars`. */
async function loadEnv(vars: Record<string, string>): Promise<LoadResult> {
  // A minimal inherited environment: enough for Node to run on Windows and
  // POSIX, but nothing that could leak the developer's own configuration in
  // and make a test pass for the wrong reason.
  const childEnv: NodeJS.ProcessEnv = {
    PATH: process.env['PATH'],
    SystemRoot: process.env['SystemRoot'],
    TEMP: process.env['TEMP'],
    ...vars,
  };

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', FIXTURE],
      { cwd: SERVER_ROOT, env: childEnv },
    );
    const line = stdout.split('\n').find((entry) => entry.startsWith('RESULT ')) ?? '';
    return { ok: true, config: JSON.parse(line.slice('RESULT '.length)), message: '' };
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? '';
    const line = stdout.split('\n').find((entry) => entry.startsWith('ENV_ERROR ')) ?? '';
    const message = line ? (JSON.parse(line.slice('ENV_ERROR '.length)) as string) : stdout;
    return { ok: false, config: {}, message };
  }
}

test('a complete configuration loads', async () => {
  const result = await loadEnv(VALID_BASE);
  assert.equal(result.ok, true, result.message);
  assert.equal(result.config['AI_PROVIDER'], 'mock');
  assert.deepEqual(result.config['corsOrigins'], ['http://localhost:3000']);
});

test('missing required variables are reported by name, all at once', async () => {
  const result = await loadEnv({});
  assert.equal(result.ok, false);
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN', 'AI_PROVIDER']) {
    assert.match(result.message, new RegExp(key), `expected ${key} in the failure message`);
  }
});

test('the failure message never contains a secret value', async () => {
  const result = await loadEnv({ ...VALID_BASE, JWT_SECRET: 'too-short-but-secret' });
  assert.equal(result.ok, false);
  assert.match(result.message, /JWT_SECRET/);
  assert.ok(
    !result.message.includes('too-short-but-secret'),
    'the offending VALUE must never be echoed back',
  );
});

// --- Lumiere F1 / F5 ------------------------------------------------------
test('F1: a blank optional string behaves as unset, not as a validation error', async () => {
  const result = await loadEnv({ ...VALID_BASE, JWT_EXPIRES_IN: '', OPENAI_MODEL: '' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.config['JWT_EXPIRES_IN'], '7d');
  assert.equal(result.config['OPENAI_MODEL'], 'gpt-4o-mini');
});

test('F5: a blank optional number falls back to its default and never becomes 0', async () => {
  const result = await loadEnv({
    ...VALID_BASE,
    PORT: '',
    AI_MAX_TOKENS: '',
    AI_TIMEOUT_MS: '',
    DB_POOL_MAX: '',
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.config['PORT'], 4000);
  assert.equal(result.config['AI_MAX_TOKENS'], 900);
  assert.equal(result.config['AI_TIMEOUT_MS'], 20_000);
  assert.equal(result.config['DB_POOL_MAX'], 3);

  // The heart of F5: an empty string coerced to 0 would silently disable a
  // limit while leaving the service apparently healthy.
  for (const key of ['PORT', 'AI_MAX_TOKENS', 'AI_TIMEOUT_MS', 'DB_POOL_MAX']) {
    assert.notEqual(result.config[key], 0, `${key} must never silently become 0`);
  }
});

test('a blank NODE_ENV falls back to development', async () => {
  const result = await loadEnv({ ...VALID_BASE, NODE_ENV: '' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.config['NODE_ENV'], 'development');
});

test('a blank boolean falls back to its secure default', async () => {
  const result = await loadEnv({ ...VALID_BASE, DB_SSL_REJECT_UNAUTHORIZED: '' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.config['DB_SSL_REJECT_UNAUTHORIZED'], true);
});

// --- fail-closed guards ---------------------------------------------------
test('choosing openai without a key is refused', async () => {
  const result = await loadEnv({ ...VALID_BASE, AI_PROVIDER: 'openai' });
  assert.equal(result.ok, false);
  assert.match(result.message, /OPENAI_API_KEY/);
});

test('a blank openai key is refused exactly like a missing one', async () => {
  const result = await loadEnv({ ...VALID_BASE, AI_PROVIDER: 'openai', OPENAI_API_KEY: '' });
  assert.equal(result.ok, false);
  assert.match(result.message, /OPENAI_API_KEY/);
});

test('choosing gemini without a key is refused', async () => {
  const result = await loadEnv({ ...VALID_BASE, AI_PROVIDER: 'gemini' });
  assert.equal(result.ok, false);
  assert.match(result.message, /GEMINI_API_KEY/);
});

test('an unknown AI_PROVIDER is refused', async () => {
  const result = await loadEnv({ ...VALID_BASE, AI_PROVIDER: 'claude-in-a-teacup' });
  assert.equal(result.ok, false);
  assert.match(result.message, /AI_PROVIDER/);
});

test('wildcard CORS is refused in production but allowed in development', async () => {
  const inProduction = await loadEnv({ ...VALID_BASE, CORS_ORIGIN: '*', NODE_ENV: 'production' });
  assert.equal(inProduction.ok, false);
  assert.match(inProduction.message, /CORS_ORIGIN/);

  const inDevelopment = await loadEnv({ ...VALID_BASE, CORS_ORIGIN: '*' });
  assert.equal(inDevelopment.ok, true, inDevelopment.message);
});

test('a short JWT_SECRET is refused', async () => {
  const result = await loadEnv({ ...VALID_BASE, JWT_SECRET: 'a'.repeat(31) });
  assert.equal(result.ok, false);
  assert.match(result.message, /JWT_SECRET/);
});

test('CORS_ORIGIN is split into a trimmed list', async () => {
  const result = await loadEnv({
    ...VALID_BASE,
    CORS_ORIGIN: ' http://localhost:3000 , https://thelittleuniverse.space ,, ',
  });
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(result.config['corsOrigins'], [
    'http://localhost:3000',
    'https://thelittleuniverse.space',
  ]);
});
