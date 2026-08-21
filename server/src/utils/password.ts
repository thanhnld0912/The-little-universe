import bcrypt from 'bcryptjs';

/**
 * bcrypt cost factor.
 *
 * bcryptjs is a pure-JavaScript implementation, so it is several times slower
 * than a native binding at the same cost. 10 is the library default and hashes
 * in roughly 100-300 ms here, which is a sane balance for a serverless
 * function where the request is billed by wall-clock time. Raising this is a
 * deliberate decision to be made with a measurement, not a guess.
 */
const COST = 10;

/**
 * bcrypt only considers the first 72 BYTES of a password and silently ignores
 * the rest. Two different long passwords sharing a 72-byte prefix would
 * therefore be interchangeable. We reject over-long input at validation time
 * instead (see schemas/auth.schema.ts); this constant is the single source of
 * truth for that limit.
 */
export const MAX_PASSWORD_BYTES = 72;

export function passwordByteLength(plain: string): number {
  return Buffer.byteLength(plain, 'utf8');
}

export async function hashPassword(plain: string): Promise<string> {
  if (passwordByteLength(plain) > MAX_PASSWORD_BYTES) {
    // Defence in depth: validation should already have rejected this.
    throw new Error('Password exceeds the maximum supported length.');
  }
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // A malformed stored hash must read as "does not match", never as an
    // exception that could be distinguished from a wrong password.
    return false;
  }
}

/**
 * A real bcrypt hash of a value nobody can supply, used to spend the same time
 * comparing when the account does not exist. Without this, "unknown email"
 * returns measurably faster than "wrong password" and the login endpoint
 * becomes an account-enumeration oracle.
 */
const DUMMY_HASH = bcrypt.hashSync('the-little-universe::absent-account', COST);

export async function spendComparisonTime(): Promise<void> {
  await bcrypt.compare('the-little-universe::absent-account-probe', DUMMY_HASH);
}
