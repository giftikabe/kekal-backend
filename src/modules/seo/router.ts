import { Hono } from 'hono';
import { createDb } from '../../db/client';
import { requireAuth } from '../../middleware/requireAuth';
import { ok, fail } from '../../lib/response';
import type { AppEnv } from '../../types/env';
import * as seoService from './service';

// Was: type Env = { Bindings: { DATABASE_URL: string } }
// That local type only declared DATABASE_URL (missing JWT_SECRET, etc.) and
// had no Variables, so c.get('admin') after requireAuth resolved to
// `unknown` instead of AuthedAdmin, and requireAuth (typed for AppEnv)
// didn't structurally match this router's env. Use the shared AppEnv type
// everywhere instead, per the note at the top of src/types/env.ts.
export const seoRouter = new Hono<AppEnv>();

seoRouter.get('/public/:slug', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  try {
    const seo = await seoService.getPublicSeoBySlug(db, c.req.param('slug'));
    if (!seo) return fail(c, 'SEO settings not found for this page', 'SEO_NOT_FOUND', 404);
    return ok(c, { title: seo.title, description: seo.description, structuredData: seo.structuredData });
  } catch (err) {
    return fail(c, (err as Error).message, 'SEO_ERROR', 500);
  }
});

seoRouter.use('*', requireAuth);

// List every page's SEO settings — this is what the admin SEO dashboard
// (GET /api/seo) calls. It previously had no matching route at all, so the
// SEO admin screen always showed "No pages with SEO records yet."
seoRouter.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  try {
    const list = await seoService.listAllPageSeo(db);
    return ok(c, list);
  } catch (err) {
    return fail(c, (err as Error).message, 'SEO_ERROR', 500);
  }
});

seoRouter.get('/:pageId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  try {
    const seo = await seoService.getSeoByPageId(db, c.req.param('pageId'));
    if (!seo) return fail(c, 'SEO settings not found for this page', 'SEO_NOT_FOUND', 404);
    return ok(c, seo);
  } catch (err) {
    return fail(c, (err as Error).message, 'SEO_ERROR', 500);
  }
});

seoRouter.get('/row/:rowId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  try {
    const seo = await seoService.getSeoByRowId(db, c.req.param('rowId'));
    if (!seo) return fail(c, 'SEO settings not found for this row', 'SEO_NOT_FOUND', 404);
    return ok(c, seo);
  } catch (err) {
    return fail(c, (err as Error).message, 'SEO_ERROR', 500);
  }
});

seoRouter.patch('/:id', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  try {
    const body = await c.req.json<{ title?: string; description?: string; keywords?: string[]; structuredData?: unknown }>();
    const updated = await seoService.applyManualOverride(db, c.req.param('id'), {
      title: body.title, description: body.description, keywords: body.keywords, structuredData: body.structuredData as never,
    });
    if (!updated) return fail(c, 'SEO settings not found', 'SEO_NOT_FOUND', 404);
    return ok(c, updated);
  } catch (err) {
    return fail(c, (err as Error).message, 'SEO_ERROR', 400);
  }
});

seoRouter.post('/:id/regenerate', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  try {
    const updated = await seoService.regenerate(db, c.req.param('id'));
    if (!updated) return fail(c, 'SEO settings not found', 'SEO_NOT_FOUND', 404);
    return ok(c, updated);
  } catch (err) {
    return fail(c, (err as Error).message, 'SEO_ERROR', 500);
  }
});