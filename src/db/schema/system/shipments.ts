import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { orders } from './orders';

export const shipments = pgTable('shipments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  trackingNote: text('tracking_note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdIdx: index('shipments_order_id_idx').on(table.orderId),
}));

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
