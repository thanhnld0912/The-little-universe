import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

/**
 * Return `date` columns as the plain 'YYYY-MM-DD' string Postgres stores.
 *
 * By default `pg` converts OID 1082 (date) into a JavaScript `Date` at LOCAL
 * midnight. For a value that has no time and no zone, that is actively wrong:
 * `2026-08-21` becomes `2026-08-20T17:00:00Z` for a developer at UTC+7, and
 * calling `.toISOString().slice(0, 10)` on it then yields the PREVIOUS day.
 * Since the daily and weekly caches are keyed by date, that off-by-one would
 * make the cache miss once per day, silently regenerating a prediction that
 * already existed.
 *
 * Registered once, at module scope, before any pool is created.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

/**
 * ONE pool per process, created lazily and cached on `globalThis`.
 *
 * Why `globalThis` and not a plain module-level `let`:
 *   - Vercel keeps a warm serverless instance alive between invocations; a
 *     module-level cache survives, but a bundler that produces more than one
 *     copy of this module would create more than one pool.
 *   - `tsx watch` re-evaluates modules on every save, which would otherwise
 *     leak a pool per edit during local development.
 *
 * NEVER call `new Pool()` anywhere else — not in a route, controller, service
 * or repository. Serverless multiplies instances, and each stray pool
 * multiplies connections against a database that has a hard connection cap.
 */
const POOL_KEY = Symbol.for('the-little-universe.pg-pool');

type PoolCache = { [POOL_KEY]?: pg.Pool };

function createPool(): pg.Pool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: resolveSsl(env.DATABASE_URL),
  });

  // An error on an IDLE client is emitted on the pool, not on any query.
  // Without this listener Node treats it as an unhandled 'error' event and
  // takes the whole process down.
  pool.on('error', (error) => {
    console.error('[db] idle client error:', error.message);
  });

  return pool;
}

function resolveSsl(connectionString: string): pg.PoolConfig['ssl'] {
  let host = '';
  let sslmode = '';
  try {
    const url = new URL(connectionString);
    host = url.hostname;
    sslmode = url.searchParams.get('sslmode') ?? '';
  } catch {
    // Unparseable URL: let pg produce the real connection error instead of
    // guessing here.
    return undefined;
  }

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (isLocal || sslmode === 'disable') return false;

  return { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED };
}

export function getPool(): pg.Pool {
  const cache = globalThis as PoolCache;
  if (!cache[POOL_KEY]) {
    cache[POOL_KEY] = createPool();
  }
  return cache[POOL_KEY];
}

/** Local/test teardown only. Serverless must never close the shared pool. */
export async function closePool(): Promise<void> {
  const cache = globalThis as PoolCache;
  const pool = cache[POOL_KEY];
  if (!pool) return;
  delete cache[POOL_KEY];
  await pool.end();
}
