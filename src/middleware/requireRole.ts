import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env';

export const requireRole = (
  allowedRoles: Array<'super_admin' | 'editor'>,
): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const admin = c.get('admin');

    if (!admin || !allowedRoles.includes(admin.role)) {
      return c.json(
        { error: { message: 'You do not have permission to perform this action', code: 'FORBIDDEN' } },
        403,
      );
    }

    return await next();
  };
};