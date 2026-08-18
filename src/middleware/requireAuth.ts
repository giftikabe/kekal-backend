import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env';
import { verifyToken } from '../modules/auth/service';

export interface AuthedAdmin {
  id: string;
  role: 'super_admin' | 'editor';
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');

  if (!header || !header.startsWith('Bearer ')) {
    return c.json(
      { error: { message: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' } },
      401,
    );
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);

    if (payload.type !== 'access') {
      return c.json(
        { error: { message: 'A valid access token is required', code: 'UNAUTHORIZED' } },
        401,
      );
    }

    c.set('admin', { id: payload.sub, role: payload.role });
    return await next();
  } catch {
    return c.json(
      { error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' } },
      401,
    );
  }
};