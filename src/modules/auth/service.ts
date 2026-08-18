import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const BCRYPT_SALT_ROUNDS = 10;

export type AdminRole = 'super_admin' | 'editor';

export interface AccessTokenPayload {
  sub: string;
  role: AdminRole;
  type: 'access';
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  role: AdminRole;
  type: 'refresh';
  iat: number;
  exp: number;
}

export type AuthTokenPayload = AccessTokenPayload | RefreshTokenPayload;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signAccessToken(adminId: string, role: AdminRole, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: adminId, role, type: 'access', iat: now, exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  return sign(payload as unknown as Record<string, unknown>, secret);
}

export async function signRefreshToken(adminId: string, role: AdminRole, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: RefreshTokenPayload = {
    sub: adminId, role, type: 'refresh', iat: now, exp: now + REFRESH_TOKEN_TTL_SECONDS,
  };
  return sign(payload as unknown as Record<string, unknown>, secret);
}

export async function verifyToken(token: string, secret: string): Promise<AuthTokenPayload> {
  const payload = await verify(token, secret, 'HS256');
  return payload as unknown as AuthTokenPayload;
}