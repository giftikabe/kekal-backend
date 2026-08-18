// src/middleware/errorHandler.ts
//
// Centralized error handler registered via `app.onError(errorHandler)` in
// src/index.ts. Every unhandled throw anywhere in the app ends up here.
//
// Response shape (mirrors src/lib/response.ts `fail`):
//   { error: { message: string, code: string } }
//
// To signal a known error from inside a handler, throw new AppError(...).
// For expected, non-exceptional failures (not-found, validation) prefer
// returning `fail(c, ...)` directly instead of throwing.

import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../types/env';

/**
 * Throw this (or a subclass) anywhere in the app to produce a structured
 * error response with a specific HTTP status and machine-readable code.
 *
 * Example:
 *   throw new AppError('Brand not found', 404, 'NOT_FOUND');
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  // Known app-level errors with explicit status + code.
  if (err instanceof AppError) {
    return c.json(
      { error: { message: err.message, code: err.code } },
      err.status as Parameters<typeof c.json>[1],
    );
  }

  // Hono's own HTTPException (e.g. thrown by built-in validators).
  if (err instanceof HTTPException) {
    return c.json(
      { error: { message: err.message || 'Request failed', code: `HTTP_${err.status}` } },
      err.status,
    );
  }

  // Anything else — log server-side, never expose internals to the client.
  console.error('[errorHandler] unhandled error:', err);
  return c.json(
    { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
    500,
  );
};