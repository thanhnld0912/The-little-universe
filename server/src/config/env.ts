import 'dotenv/config';
import { z } from 'zod';
import { blankToUndefined, splitList } from '../utils/envHelpers.js';

/** Wraps a schema so that an empty-string env value is treated as "not set". */
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blankToUndefined, schema);

/** True when the host's timezone database recognises the identifier. */
function isKnownTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    // --- required -----------------------------------------------------------
    NODE_ENV: optional(z.enum(['development', 'test', 'production']).default('development')),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters (use: openssl rand -base64 48)'),
    CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required (comma-separated origins, or *)'),
    AI_PROVIDER: z.enum(['mock', 'openai', 'gemini']),

    // --- optional -----------------------------------------------------------
    PORT: optional(z.coerce.number().int().positive().max(65535).default(4000)),
    JWT_EXPIRES_IN: optional(z.string().min(1).default('7d')),

    /**
     * The IANA zone that defines when the application's day rolls over.
     *
     * Validated against the host's own timezone database rather than a
     * hard-coded list, so a typo like "Asia/Ho_Chi_Min" fails at boot instead
     * of silently falling back to UTC and shifting every reading by 7 hours.
     */
    APP_TIMEZONE: optional(
      z
        .string()
        .min(1)
        .default('Asia/Ho_Chi_Minh')
        .refine(isKnownTimeZone, 'APP_TIMEZONE must be a valid IANA timezone identifier'),
    ),

    OPENAI_API_KEY: optional(z.string().min(1).optional()),
    OPENAI_MODEL: optional(z.string().min(1).default('gpt-4o-mini')),

    GEMINI_API_KEY: optional(z.string().min(1).optional()),
    GEMINI_MODEL: optional(z.string().min(1).default('gemini-2.0-flash')),

    AI_MAX_TOKENS: optional(z.coerce.number().int().positive().max(8192).default(900)),
    AI_TIMEOUT_MS: optional(z.coerce.number().int().positive().max(120_000).default(20_000)),

    /** Kept small on purpose: serverless instances multiply connections. */
    DB_POOL_MAX: optional(z.coerce.number().int().positive().max(20).default(3)),
    /** Escape hatch for self-signed database certificates. Never enable for Neon. */
    DB_SSL_REJECT_UNAUTHORIZED: optional(
      z
        .enum(['true', 'false'])
        .default('true')
        .transform((value) => value === 'true'),
    ),
  })
  .superRefine((value, ctx) => {
    // Fail closed: selecting a provider without its credentials must not boot.
    if (value.AI_PROVIDER === 'openai' && !value.OPENAI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['OPENAI_API_KEY'],
        message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
      });
    }
    if (value.AI_PROVIDER === 'gemini' && !value.GEMINI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when AI_PROVIDER=gemini',
      });
    }
    // Never let an unsafe default through in production.
    if (value.NODE_ENV === 'production' && splitList(value.CORS_ORIGIN).includes('*')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN must not be "*" when NODE_ENV=production',
      });
    }
  });

export type Env = z.infer<typeof envSchema> & { corsOrigins: string[] };

export class EnvironmentError extends Error {
  override readonly name = 'EnvironmentError';
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Report the NAMES of the offending variables only — never their values.
    const lines = parsed.error.issues.map((issue) => {
      const key = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${key}: ${issue.message}`;
    });
    throw new EnvironmentError(
      `Invalid environment configuration:\n${lines.join('\n')}\n\nSee server/.env.example for the expected variables.`,
    );
  }

  return { ...parsed.data, corsOrigins: splitList(parsed.data.CORS_ORIGIN) };
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
