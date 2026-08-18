import { Hono } from 'hono';
import { createDb } from '../../db/client';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { ok, fail } from '../../lib/response';
import { updateBrandSchema } from '../pages/validation';
import * as brandService from './brandService';
import type { AppEnv } from '../../types/env';

export const brandRouter = new Hono<AppEnv>();

brandRouter.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const current = await brandService.getBrand(db);
  return ok(c, current);
});

brandRouter.patch('/', requireAuth, requireRole(['super_admin', 'editor']), async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = updateBrandSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  const updated = await brandService.updateBrand(db, parsed.data);
  return ok(c, updated);
});