import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const ALGORITHM = 'HS256' as const;
const ISSUER = 'the-little-universe';
const AUDIENCE = 'the-little-universe:web';

/**
 * The complete token payload.
 *
 * Identity ONLY — the subject claim and nothing else. No email, no display
 * name, no role, and above all no password hash. A JWT is signed but NOT
 * encrypted: anyone holding the token can read its payload, so every field
 * added here is a field published to whoever obtains it.
 *
 * Everything else is looked up from the database when it is needed, which also
 * means a changed display name or a deleted account takes effect immediately
 * rather than lingering until the token expires.
 */
export interface AccessTokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  const options: SignOptions = {
    algorithm: ALGORITHM,
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign({}, env.JWT_SECRET, options);
}

/**
 * Verifies a token and returns its identity claim.
 *
 * `algorithms` is pinned deliberately. Without it, `jsonwebtoken` accepts any
 * algorithm named in the token's own header — which is attacker-controlled.
 * That is the classic algorithm-confusion vulnerability: a token claiming
 * `"alg":"none"`, or an RS256 token verified with our HS256 secret as its
 * public key, would otherwise be accepted.
 *
 * Throws `AppError.unauthorized` for every failure mode, with the same message
 * for each, so an expired token cannot be distinguished from a forged one.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch {
    throw AppError.unauthorized('Your session is not valid. Please sign in again.');
  }

  if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || decoded.sub.length === 0) {
    throw AppError.unauthorized('Your session is not valid. Please sign in again.');
  }

  return { sub: decoded.sub };
}

/**
 * Extracts a bearer token from an Authorization header.
 *
 * Returns `undefined` when the header is absent, and throws when it is present
 * but not a well-formed bearer credential — a malformed header is a client
 * error worth reporting, not something to silently treat as anonymous.
 */
export function extractBearerToken(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;

  const match = /^Bearer (.+)$/.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) {
    throw AppError.unauthorized('Authorization header must be of the form "Bearer <token>".');
  }
  return token;
}
