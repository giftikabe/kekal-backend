import { pgTable, uuid, integer, numeric, index } from 'drizzle-orm/pg-core';
import { orders, currencyEnum } from './orders';
import { customRows } from './customRows';

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  // The product is just a custom_rows row belonging to a table with is_commerce = true.
  customRowId: uuid('custom_row_id').notNull().references(() => customRows.id),
  quantity: integer('quantity').notNull(),
  // Snapshotted at checkout time so later edits to the product's price don't alter past orders.
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
}, (table) => ({
  orderIdIdx: index('order_items_order_id_idx').on(table.orderId),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
