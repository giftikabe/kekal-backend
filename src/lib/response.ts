import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json({ data }, status);
}

export function created<T>(c: Context, data: T) {
  return c.json({ data }, 201);
}

export function noContent(c: Context) {
  return c.body(null, 204);
}

export function fail(
  c: Context,
  message: string,
  code = 'ERROR',
  status: number = 400,
  details?: unknown,
) {
  return c.json(
    { error: { message, code, ...(details !== undefined ? { details } : {}) } },
    status as ContentfulStatusCode,
  );
}