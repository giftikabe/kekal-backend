import { Hono } from 'hono';
import { createDb } from '../../db/client';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { ok, fail } from '../../lib/response';
import {
  checkoutSchema, orderListQuerySchema, orderStatusSchema, saveSettingsSchema, shipmentSchema,
} from './types';
import { CommerceError } from './service';
import * as commerceService from './service';
import type { AppEnv } from '../../types/env';

export const commerceRouter = new Hono<AppEnv>();

function apiBaseUrl(url: string): string {
  return new URL(url).origin;
}

commerceRouter.get('/settings', requireAuth, requireRole(['super_admin']), async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const settings = await commerceService.getCommerceSettings(db);
  if (!settings) return ok(c, null);
  const { chapaSecretKey: _omit, ...safeSettings } = settings;
  return ok(c, safeSettings);
});

commerceRouter.post('/settings', requireAuth, requireRole(['super_admin']), async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = await c.req.json().catch(() => null);
  const parsed = saveSettingsSchema.safeParse(body);
  if (!parsed.success) return fail(c, 'Invalid settings payload', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  try {
    const settings = await commerceService.saveCommerceSettings(db, parsed.data, { apiBaseUrl: apiBaseUrl(c.req.url) });
    const { chapaSecretKey: _omit, ...safeSettings } = settings;
    return ok(c, safeSettings, 201);
  } catch (err) {
    if (err instanceof CommerceError) return fail(c, err.message, err.code, err.status);
    throw err;
  }
});

commerceRouter.post('/checkout', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = await c.req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return fail(c, 'Invalid checkout payload', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  try {
    const result = await commerceService.checkout(db, parsed.data, {
      apiBaseUrl: apiBaseUrl(c.req.url),
      storefrontBaseUrl: c.env.STOREFRONT_URL ?? apiBaseUrl(c.req.url),
    });
    return ok(c, { orderId: result.order.id, orderNumber: result.order.orderNumber, checkoutUrl: result.checkoutUrl }, 201);
  } catch (err) {
    if (err instanceof CommerceError) return fail(c, err.message, err.code, err.status);
    throw err;
  }
});

commerceRouter.post('/webhook/chapa', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rawBody = await c.req.text();
  const signature = c.req.header('chapa-signature') ?? c.req.header('Chapa-Signature');

  try {
    const result = await commerceService.handleChapaWebhook(db, rawBody, signature ?? null);
    return ok(c, result);
  } catch (err) {
    if (err instanceof CommerceError) return fail(c, err.message, err.code, err.status);
    throw err;
  }
});

commerceRouter.get('/orders', requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const parsed = orderListQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return fail(c, 'Invalid query parameters', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const results = await commerceService.listOrders(db, parsed.data);
  return ok(c, results);
});

commerceRouter.get('/orders/:id', requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const detail = await commerceService.getOrderDetail(db, c.req.param('id'));
  if (!detail) return fail(c, 'Order not found', 'ORDER_NOT_FOUND', 404);
  return ok(c, detail);
});

commerceRouter.patch('/orders/:id/status', requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = await c.req.json().catch(() => null);
  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) return fail(c, 'Invalid status payload', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  try {
    const updated = await commerceService.updateOrderStatus(db, c.req.param('id'), parsed.data.status);
    return ok(c, updated);
  } catch (err) {
    if (err instanceof CommerceError) return fail(c, err.message, err.code, err.status);
    throw err;
  }
});

commerceRouter.patch('/orders/:id/shipment', requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = await c.req.json().catch(() => null);
  const parsed = shipmentSchema.safeParse(body);
  if (!parsed.success) return fail(c, 'Invalid shipment payload', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  try {
    const shipment = await commerceService.upsertShipment(db, c.req.param('id'), parsed.data);
    return ok(c, shipment);
  } catch (err) {
    if (err instanceof CommerceError) return fail(c, err.message, err.code, err.status);
    throw err;
  }
});

export default commerceRouter;