import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { orders } from './orders';

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  chapaTxRef: text('chapa_tx_ref').notNull(),
  // Mirrors Chapa's own status vocabulary rather than a closed enum, since Chapa
  // controls what values it sends on the webhook.
  status: text('status').notNull(),
  rawResponse: jsonb('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdIdx: index('payments_order_id_idx').on(table.orderId),
  chapaTxRefIdx: index('payments_chapa_tx_ref_idx').on(table.chapaTxRef),
}));

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
