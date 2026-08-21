import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getPool } from './pool.js';

/**
 * Anything that can run a statement. Repositories accept this as an EXPLICIT,
 * REQUIRED first argument — never optional, never defaulted.
 *
 * Lumiere lesson §2: a repository constructed without a client failed at
 * runtime with `Cannot read properties of undefined (reading 'query')`.
 * Making the dependency required turns that into a compile error.
 */
export type Queryable = Pool | PoolClient;

/**
 * Runs a parameterised statement. Placeholders are ALWAYS $1, $2, $3 —
 * user input is never interpolated into SQL text.
 */
export async function query<T extends QueryResultRow>(
  db: Queryable,
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return db.query<T>(text, params as unknown[]);
}

/** Returns the first row, or `undefined` when the statement matched nothing. */
export async function queryOne<T extends QueryResultRow>(
  db: Queryable,
  text: string,
  params: readonly unknown[] = [],
): Promise<T | undefined> {
  const result = await query<T>(db, text, params);
  return result.rows[0];
}

/** Returns every row. */
export async function queryAll<T extends QueryResultRow>(
  db: Queryable,
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await query<T>(db, text, params);
  return result.rows;
}

/**
 * Runs `fn` inside a transaction on a dedicated client.
 *
 * Deliberately does NOT wrap pg errors in an application error type: callers
 * and retry logic read `error.code` (Postgres SQLSTATE), and re-wrapping
 * destroys it. Unrecognised errors are handled fail-closed by the central
 * error handler instead. (Lumiere lesson §6.)
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[db] rollback failed:', (rollbackError as Error).message);
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Lightweight connectivity probe used by the health endpoint. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await query(getPool(), 'SELECT 1');
    return true;
  } catch {
    return false;
  }
}
