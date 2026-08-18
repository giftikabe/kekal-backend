import { pgTable, uuid, text, jsonb, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const customerTypeEnum = pgEnum('customer_type', ['local', 'international']);
export const currencyEnum = pgEnum('currency', ['etb', 'usd']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'failed',
  'cancelled',
]);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  customerType: customerTypeEnum('customer_type').notNull(),
  contactName: text('contact_name').notNull(),
  // Required for local customers, optional for international (address covers contact instead).
  contactPhone: text('contact_phone'),
  // Shape: { line1, line2?, city, region?, postalCode?, country }. Null for local orders
  // that only need a phone number for delivery coordination.
  shippingAddress: jsonb('shipping_address'),
  currency: currencyEnum('currency').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
