import type { Response } from 'express';
import type { ErrorCodeValue } from './errors.js';

export interface SuccessBody<T> {
  success: true;
  data: T;
}

export interface ErrorBody {
  success: false;
  error: {
    code: ErrorCodeValue;
    message: string;
    details?: unknown;
  };
}

export function sendData<T>(res: Response, data: T, status = 200): Response {
  const body: SuccessBody<T> = { success: true, data };
  return res.status(status).json(body);
}

export function sendError(
  res: Response,
  code: ErrorCodeValue,
  message: string,
  status: number,
  details?: unknown,
): Response {
  const body: ErrorBody = {
    success: false,
    // `details` is omitted entirely when absent. Lumiere lesson §7: an empty
    // object/array is truthy on the client and silently renders as "present".
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return res.status(status).json(body);
}
