import { getPool } from '../db/pool.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import {
  findUserById,
  insertUser,
  findUserByEmailWithSecret,
  UNIQUE_VIOLATION,
  type UserRow,
} from '../repositories/user.repository.js';
import { hashPassword, spendComparisonTime, verifyPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

/** The user shape sent to clients. Contains no hash and no internal state. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
  expiresIn: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString(),
  };
}

function hasSqlState(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  let row: UserRow;
  try {
    row = await insertUser(getPool(), {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });
  } catch (error) {
    if (hasSqlState(error, UNIQUE_VIOLATION)) {
      // Deliberate trade-off: registration necessarily reveals whether an
      // address is already taken, because the alternative (pretending to
      // succeed) leaves a real user unable to understand why they cannot sign
      // in. Login, where enumeration actually matters, gives nothing away.
      throw AppError.conflict('That email address is already registered.');
    }
    // Anything else is unrecognised and must not be described to the client;
    // the central error handler turns it into a generic 500.
    throw error;
  }

  return {
    user: toPublicUser(row),
    token: signAccessToken(row.id),
    expiresIn: env.JWT_EXPIRES_IN,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const account = await findUserByEmailWithSecret(getPool(), input.email);

  if (!account) {
    // Spend comparable time before failing. Returning immediately here would
    // make "no such account" measurably faster than "wrong password", turning
    // this endpoint into an account-enumeration oracle.
    await spendComparisonTime();
    throw AppError.unauthorized('Invalid email or password.');
  }

  const matches = await verifyPassword(input.password, account.password_hash);
  if (!matches) {
    // The SAME message and status as the branch above, on purpose.
    throw AppError.unauthorized('Invalid email or password.');
  }

  const { password_hash: _discarded, ...row } = account;
  return {
    user: toPublicUser(row),
    token: signAccessToken(row.id),
    expiresIn: env.JWT_EXPIRES_IN,
  };
}

/**
 * Resolves the account behind a verified token.
 *
 * The token carries only an id, so the account is read fresh on every call.
 * A token that outlives its account therefore stops working immediately
 * instead of at expiry.
 */
export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const row = await findUserById(getPool(), userId);
  if (!row) {
    throw AppError.unauthorized('Your session is not valid. Please sign in again.');
  }
  return toPublicUser(row);
}
