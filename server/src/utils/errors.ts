/** Stable, client-facing error codes. Never invent one at a call site. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * An error whose message is SAFE to send to a client.
 *
 * Anything that is not an `AppError` is treated as untrusted by the error
 * handler and reported as a generic 500 — see `middleware/errorHandler.ts`.
 */
export class AppError extends Error {
  override readonly name = 'AppError';
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCodeValue, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
  static unauthorized(message = 'Authentication is required.'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
  }
  static forbidden(message = 'You do not have access to this resource.'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }
  static notFound(message = 'Resource not found.'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }
  static conflict(message: string): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409);
  }
  static rateLimited(message = 'Too many requests. Please try again shortly.'): AppError {
    return new AppError(ErrorCode.RATE_LIMITED, message, 429);
  }
  static upstream(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.UPSTREAM_ERROR, message, 502, details);
  }
}
