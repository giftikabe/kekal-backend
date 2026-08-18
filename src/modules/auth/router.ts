import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb } from '../../db/client';
import { admins } from '../../db/schema/system';
import { verifyPassword, hashPassword, signAccessToken, signRefreshToken, verifyToken } from './service';
import { requireAuth } from '../../middleware/requireAuth';
import type { AppEnv } from '../../types/env';


export const authRouter = new Hono<AppEnv>();

authRouter.post('/login', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({} as { email?: string; password?: string }));
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: { message: 'Email and password are required', code: 'VALIDATION_ERROR' } }, 400);
  }

  const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (!admin) {
    return c.json({ error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } }, 401);
  }

  const passwordValid = await verifyPassword(password, admin.passwordHash);
  if (!passwordValid) {
    return c.json({ error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } }, 401);
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(admin.id, admin.role, c.env.JWT_SECRET),
    signRefreshToken(admin.id, admin.role, c.env.JWT_SECRET),
  ]);

  return c.json({ accessToken, refreshToken });
});

authRouter.post('/refresh', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = await c.req
    .json<{ refreshToken?: string }>()
    .catch(() => ({} as { refreshToken?: string }));
  const { refreshToken } = body;

  if (!refreshToken) {
    return c.json({ error: { message: 'refreshToken is required', code: 'VALIDATION_ERROR' } }, 400);
  }

  try {
    const payload = await verifyToken(refreshToken, c.env.JWT_SECRET);

    if (payload.type !== 'refresh') {
      return c.json({ error: { message: 'A valid refresh token is required', code: 'UNAUTHORIZED' } }, 401);
    }

    const [admin] = await db.select().from(admins).where(eq(admins.id, payload.sub)).limit(1);
    if (!admin) {
      return c.json({ error: { message: 'Admin no longer exists', code: 'UNAUTHORIZED' } }, 401);
    }

    const accessToken = await signAccessToken(admin.id, admin.role, c.env.JWT_SECRET);
    return c.json({ accessToken });
  } catch {
    return c.json({ error: { message: 'Invalid or expired refresh token', code: 'UNAUTHORIZED' } }, 401);
  }
});

authRouter.post('/logout', async (c) => {
  return c.json({ success: true });
});

authRouter.get('/me', requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const { id } = c.get('admin');

  const [admin] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  if (!admin) {
    return c.json({ error: { message: 'Admin no longer exists', code: 'NOT_FOUND' } }, 404);
  }

  return c.json({ id: admin.id, email: admin.email, role: admin.role });
});

authRouter.post('/change-password', requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const { id } = c.get('admin');
  const body = await c.req
    .json<{ currentPassword?: string; newPassword?: string }>()
    .catch(() => ({} as { currentPassword?: string; newPassword?: string }));

  if (!body.currentPassword || !body.newPassword || body.newPassword.length < 8) {
    return c.json(
      { error: { message: 'currentPassword and a newPassword (min 8 chars) are required', code: 'VALIDATION_ERROR' } },
      400,
    );
  }

  const [admin] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  if (!admin) {
    return c.json({ error: { message: 'Admin no longer exists', code: 'NOT_FOUND' } }, 404);
  }

  const valid = await verifyPassword(body.currentPassword, admin.passwordHash);
  if (!valid) {
    return c.json({ error: { message: 'Current password is incorrect', code: 'INVALID_CREDENTIALS' } }, 401);
  }

  const newHash = await hashPassword(body.newPassword);
  await db.update(admins).set({ passwordHash: newHash }).where(eq(admins.id, id));

  return c.json({ success: true });
});