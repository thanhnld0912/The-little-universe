import { z } from 'zod';
import { MAX_PASSWORD_BYTES, passwordByteLength } from '../utils/password.js';

/**
 * Email is normalised here, once, so that every layer below receives the same
 * canonical form. The database backs this up with a unique index on
 * `lower(email)` — neither mechanism is trusted to be the only one.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Please enter an email address.')
  .max(254, 'That email address is too long.')
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: 'Please enter a valid email address.',
  });

/**
 * The upper bound is a correctness requirement, not a style choice: bcrypt
 * silently ignores everything past 72 bytes, so accepting a longer password
 * would mean two different passwords could unlock the same account.
 * Measured in BYTES, because a passphrase of emoji or non-Latin script reaches
 * the limit in far fewer characters than `.length` suggests.
 */
const passwordField = z
  .string()
  .min(8, 'Please choose a password of at least 8 characters.')
  .refine((value) => passwordByteLength(value) <= MAX_PASSWORD_BYTES, {
    message: `Password must be at most ${MAX_PASSWORD_BYTES} bytes long.`,
  });

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z
    .string()
    .trim()
    .min(1, 'Please enter a name, or leave the field out entirely.')
    .max(80, 'That name is a little too long.')
    .optional(),
});

/**
 * Login deliberately does NOT reuse `passwordField`. Applying the registration
 * policy here would let an attacker learn the rules (and rule changes) from
 * the login endpoint, and would reject a legitimate older password that no
 * longer satisfies a tightened policy.
 */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Please enter your password.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
