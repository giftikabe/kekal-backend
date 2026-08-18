import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { commerceSettings } from '../../db/schema/system/commerceSettings';
import { orders } from '../../db/schema/system/orders';
import { orderItems } from '../../db/schema/system/orderItems';
import { payments } from '../../db/schema/system/payments';
import { shipments } from '../../db/schema/system/shipments';import { customRows } from '../../db/schema/system/customRows';
import {
  ChapaError, initializeChapaPayment, verifyChapaKeys, verifyChapaSignature, verifyChapaTransaction,
} from './chapaClient';
import type { CheckoutInput, OrderStatusValue, SaveSettingsInput, ShipmentInput } from './types';

export class CommerceError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) {
    super(message);
    this.name = 'CommerceError';
  }
}

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KK-${ts}-${rand}`;
}

export async function getCommerceSettings(db: Database) {
  const [row] = await db.select().from(commerceSettings).limit(1);
  return row ?? null;
}

export interface SettingsEnv { apiBaseUrl: string; }

export async function saveCommerceSettings(db: Database, input: SaveSettingsInput, env: SettingsEnv) {
  const keysValid = await verifyChapaKeys(input.chapaSecretKey);
  if (!keysValid) throw new CommerceError('Chapa rejected the provided keys', 'CHAPA_KEYS_INVALID', 400);

  const webhookUrl = `${env.apiBaseUrl}/api/commerce/webhook/chapa`;
  const existing = await getCommerceSettings(db);

  const values = {
    chapaPublicKey: input.chapaPublicKey,
    chapaSecretKey: input.chapaSecretKey,
    isActive: true,
    webhookUrl,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(commerceSettings).set(values).where(eq(commerceSettings.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(commerceSettings).values(values).returning();
  return created;
}

export interface CheckoutEnv { apiBaseUrl: string; storefrontBaseUrl: string; }
export interface CheckoutResult { order: typeof orders.$inferSelect; checkoutUrl: string; }

export async function checkout(db: Database, input: CheckoutInput, env: CheckoutEnv): Promise<CheckoutResult> {
  const settings = await getCommerceSettings(db);
  if (!settings || !settings.isActive) throw new CommerceError('Commerce is not active', 'COMMERCE_NOT_ACTIVE', 400);

  type ResolvedItem = { customRowId: string; quantity: number; unitPrice: number };
  const resolvedItems: ResolvedItem[] = [];
  let totalAmount = 0;

  for (const item of input.items) {
    const [row] = await db.select().from(customRows).where(eq(customRows.id, item.customRowId)).limit(1);
    if (!row) throw new CommerceError(`Product not found: ${item.customRowId}`, 'PRODUCT_NOT_FOUND', 400);

    const price = (row.data as Record<string, any> | null)?.price?.[input.currency];
    if (typeof price !== 'number') {
      throw new CommerceError(`Product ${item.customRowId} has no ${input.currency} price set`, 'PRICE_MISSING', 400);
    }

    resolvedItems.push({ customRowId: item.customRowId, quantity: item.quantity, unitPrice: price });
    totalAmount += price * item.quantity;
  }

  if (!settings.chapaSecretKey) {
    throw new CommerceError('Chapa secret key is not configured', 'CHAPA_KEYS_MISSING', 400);
  }

  const orderNumber = generateOrderNumber();

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      customerType: input.customerType,
      contactName: input.contactName,
      contactPhone: input.customerType === 'local' ? input.contactPhone ?? null : null,
      shippingAddress: input.customerType === 'international' ? input.shippingAddress ?? null : null,
      currency: input.currency,
      totalAmount: totalAmount.toFixed(2),
      status: 'pending',
    })
    .returning();

  await db.insert(orderItems).values(
    resolvedItems.map((i) => ({
      orderId: order.id, customRowId: i.customRowId, quantity: i.quantity,
      unitPrice: i.unitPrice.toFixed(2), currency: input.currency,
    })),
  );

  try {
    const chapaInit = await initializeChapaPayment({
      secretKey: settings.chapaSecretKey,
      amount: totalAmount,
      currency: input.currency.toUpperCase(),
      txRef: orderNumber,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      callbackUrl: `${env.apiBaseUrl}/api/commerce/webhook/chapa`,
      returnUrl: `${env.storefrontBaseUrl}/order-status?ref=${orderNumber}`,
    });

    await db.insert(payments).values({
      orderId: order.id, chapaTxRef: orderNumber, status: 'initialized', rawResponse: chapaInit.raw,
    });

    return { order, checkoutUrl: chapaInit.checkoutUrl };
  } catch (err) {
    await db.update(orders).set({ status: 'failed', updatedAt: new Date() }).where(eq(orders.id, order.id));
    if (err instanceof ChapaError) throw new CommerceError('Could not start payment with Chapa', 'CHAPA_INIT_FAILED', 502);
    throw err;
  }
}

export interface WebhookResult { orderId: string; status: 'paid' | 'failed'; }

export async function handleChapaWebhook(db: Database, rawBody: string, signatureHeader: string | null): Promise<WebhookResult> {
  const settings = await getCommerceSettings(db);
  if (!settings) throw new CommerceError('Commerce is not configured', 'COMMERCE_NOT_CONFIGURED', 400);
  if (!settings.chapaSecretKey) {
    throw new CommerceError('Chapa secret key is not configured', 'CHAPA_KEYS_MISSING', 400);
  }

  const signatureOk = await verifyChapaSignature(rawBody, signatureHeader, settings.chapaSecretKey);
  if (!signatureOk) throw new CommerceError('Invalid webhook signature', 'INVALID_SIGNATURE', 401);

  let payload: { tx_ref?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new CommerceError('Malformed webhook payload', 'MALFORMED_PAYLOAD', 400);
  }

  if (!payload.tx_ref) throw new CommerceError('Webhook payload missing tx_ref', 'MALFORMED_PAYLOAD', 400);

  const [payment] = await db.select().from(payments).where(eq(payments.chapaTxRef, payload.tx_ref)).limit(1);
  if (!payment) throw new CommerceError(`No payment found for tx_ref ${payload.tx_ref}`, 'PAYMENT_NOT_FOUND', 404);

  const verified = await verifyChapaTransaction(payload.tx_ref, settings.chapaSecretKey);
  const newStatus: 'paid' | 'failed' = verified.status === 'success' ? 'paid' : 'failed';

  await db.update(payments).set({ status: newStatus, rawResponse: verified.raw }).where(eq(payments.id, payment.id));
  await db.update(orders).set({ status: newStatus, updatedAt: new Date() }).where(eq(orders.id, payment.orderId));

  return { orderId: payment.orderId, status: newStatus };
}

export interface ListOrdersParams { status?: OrderStatusValue; page: number; pageSize: number; }

export async function listOrders(db: Database, { status, page, pageSize }: ListOrdersParams) {
  const query = db.select().from(orders).orderBy(desc(orders.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  return status ? query.where(eq(orders.status, status)) : query;
}

export async function getOrderDetail(db: Database, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;

  const [items, [payment], [shipment]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)).limit(1),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1),
  ]);

  return { order, items, payment: payment ?? null, shipment: shipment ?? null };
}

export async function updateOrderStatus(db: Database, orderId: string, status: OrderStatusValue) {
  const [updated] = await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
  if (!updated) throw new CommerceError('Order not found', 'ORDER_NOT_FOUND', 404);
  return updated;
}

export async function upsertShipment(db: Database, orderId: string, input: ShipmentInput) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new CommerceError('Order not found', 'ORDER_NOT_FOUND', 404);

  const [existing] = await db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1);

  if (existing) {
    const [updated] = await db
      .update(shipments)
      .set({ status: input.status, trackingNote: input.trackingNote ?? null, updatedAt: new Date() })
      .where(eq(shipments.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(shipments)
    .values({ orderId, status: input.status, trackingNote: input.trackingNote ?? null })
    .returning();
  return created;
}