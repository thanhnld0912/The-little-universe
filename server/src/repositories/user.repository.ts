import type { Queryable } from '../db/query.js';
import { queryOne } from '../db/query.js';

/**
 * A user as the rest of the application is allowed to see them.
 *
 * `password_hash` is deliberately absent from this type. The ONLY function
 * that can return it is `findByEmailWithSecret`, whose name says so; every
 * other query in this file selects `PUBLIC_COLUMNS`. That makes leaking the
 * hash a visible, deliberate act rather than something that can happen by
 * forgetting to strip a field.
 */
export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Login only. Never return a value of this type from a service. */
export interface UserWithSecret extends UserRow {
  password_hash: string;
}

const PUBLIC_COLUMNS = 'id, email, display_name, created_at, updated_at';

/** Postgres SQLSTATE for unique_violation. */
export const UNIQUE_VIOLATION = '23505';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string | undefined;
}

/**
 * Every function takes its `Queryable` as an explicit, REQUIRED first
 * argument — never optional, never defaulted to the pool. Lumiere lesson §2:
 * a repository that could be constructed without a client failed at runtime
 * with `Cannot read properties of undefined (reading 'query')`. Requiring it
 * turns that class of mistake into a compile error, and lets any of these run
 * inside a caller's transaction.
 */
export async function findUserById(db: Queryable, id: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>(db, `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export async function findUserByEmail(db: Queryable, email: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>(db, `SELECT ${PUBLIC_COLUMNS} FROM users WHERE lower(email) = $1`, [
    email.toLowerCase(),
  ]);
}

/**
 * The single place a password hash leaves the database. Used by the login
 * flow and nothing else.
 */
export async function findUserByEmailWithSecret(
  db: Queryable,
  email: string,
): Promise<UserWithSecret | undefined> {
  return queryOne<UserWithSecret>(
    db,
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE lower(email) = $1`,
    [email.toLowerCase()],
  );
}

/**
 * Inserts a user and returns the PUBLIC columns only — the hash is written but
 * never read back.
 *
 * A duplicate email surfaces as a Postgres unique_violation from the
 * `users_email_lower_key` index rather than being pre-checked, because a
 * check-then-insert has a race window between the two statements.
 */
export async function insertUser(db: Queryable, input: CreateUserInput): Promise<UserRow> {
  const row = await queryOne<UserRow>(
    db,
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [input.email.toLowerCase(), input.passwordHash, input.displayName ?? null],
  );

  if (!row) {
    // RETURNING on a successful INSERT always yields a row; reaching here
    // means something is wrong that we should not paper over.
    throw new Error('User insert returned no row.');
  }
  return row;
}
