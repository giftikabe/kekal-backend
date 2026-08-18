import type { AuthedAdmin } from '../middleware/requireAuth';

export type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  CLOUDINARY_URL: string;
  CHAPA_SECRET_KEY: string;
  GITHUB_TOKEN: string;
  STOREFRONT_URL?: string;
  FRONTEND_REPO: string;
  FRONTEND_BRANCH: string;
  /** Comma-separated list of origins allowed to call this API (see index.ts). */
  ALLOWED_ORIGINS?: string;
};

export type Variables = {
  admin: AuthedAdmin;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};