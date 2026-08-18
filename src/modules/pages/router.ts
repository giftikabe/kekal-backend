import { Hono } from 'hono';
import { createDb } from '../../db/client';
import { requireAuth } from '../../middleware/requireAuth';
import { ok, fail } from '../../lib/response';
import {
  createPageSchema, updatePageSchema, createSectionSchema, reorderSectionsSchema,
  updateSectionInstanceSchema, reorderNavSchema, updateNavItemSchema,
} from './validation';
import * as pagesService from './pagesService';
import type { AppEnv } from '../../types/env';

export const pagesRouter = new Hono<AppEnv>();

pagesRouter.get('/:slug', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const result = await pagesService.getPageBySlug(db, c.req.param('slug'));
  if (!result) return fail(c, 'Page not found', 'PAGE_NOT_FOUND', 404);
  return ok(c, result);
});

pagesRouter.use('/*', requireAuth);

pagesRouter.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  return ok(c, await pagesService.listPages(db));
});

pagesRouter.get('/id/:id', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const result = await pagesService.getPageDetailById(db, c.req.param('id'));
  if (!result) return fail(c, 'Page not found', 'PAGE_NOT_FOUND', 404);
  return ok(c, result);
});

pagesRouter.post('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = createPageSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  const { page, navEntry } = await pagesService.createPage(db, parsed.data);
  return ok(c, { page, navEntry }, 201);
});

pagesRouter.patch('/:id', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = updatePageSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  const updated = await pagesService.updatePage(db, c.req.param('id'), parsed.data);
  if (!updated) return fail(c, 'Page not found', 'PAGE_NOT_FOUND', 404);
  return ok(c, updated);
});

pagesRouter.delete('/:id', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const result = await pagesService.deletePage(db, c.req.param('id'));
  if (!result.ok) {
    if (result.reason === 'is_system') return fail(c, 'System pages cannot be deleted', 'SYSTEM_PAGE_PROTECTED', 400);
    return fail(c, 'Page not found', 'PAGE_NOT_FOUND', 404);
  }
  return ok(c, { deleted: true });
});

pagesRouter.post('/:pageId/sections', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = createSectionSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  const page = await pagesService.getPageById(db, c.req.param('pageId'));
  if (!page) return fail(c, 'Page not found', 'PAGE_NOT_FOUND', 404);

  const { section, instance } = await pagesService.addSection(db, page.id, parsed.data);
  return ok(c, { section, instance }, 201);
});

pagesRouter.patch('/:pageId/sections/reorder', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = reorderSectionsSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  await pagesService.reorderSections(db, c.req.param('pageId'), parsed.data.orderedSectionIds);
  return ok(c, { reordered: true });
});

pagesRouter.delete('/:pageId/sections/:sectionId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const removed = await pagesService.removeSection(db, c.req.param('pageId'), c.req.param('sectionId'));
  if (!removed) return fail(c, 'Section not found', 'SECTION_NOT_FOUND', 404);
  return ok(c, { deleted: true });
});

export const sectionsRouter = new Hono<AppEnv>();
sectionsRouter.use('/*', requireAuth);

sectionsRouter.patch('/:instanceId', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = updateSectionInstanceSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  const updated = await pagesService.updateSectionInstance(db, c.req.param('instanceId'), parsed.data);
  if (!updated) return fail(c, 'Component instance not found', 'INSTANCE_NOT_FOUND', 404);
  return ok(c, updated);
});

export const navRouter = new Hono<AppEnv>();

navRouter.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  return ok(c, await pagesService.listNav(db));
});

navRouter.use('/*', requireAuth);

navRouter.patch('/reorder', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = reorderNavSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  await pagesService.reorderNav(db, parsed.data.orderedNavIds);
  return ok(c, { reordered: true });
});

navRouter.patch('/:id', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = updateNavItemSchema.safeParse(await c.req.json());
  if (!parsed.success) return fail(c, parsed.error.message, 'VALIDATION_ERROR', 400);

  const updated = await pagesService.updateNavLabel(db, c.req.param('id'), parsed.data.label);
  if (!updated) return fail(c, 'Nav item not found', 'NAV_ITEM_NOT_FOUND', 404);
  return ok(c, updated);
});

navRouter.delete('/:id', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const deleted = await pagesService.deleteNavItem(db, c.req.param('id'));
  if (!deleted) return fail(c, 'Nav item not found', 'NAV_ITEM_NOT_FOUND', 404);
  return ok(c, { deleted: true });
});