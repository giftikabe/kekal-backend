import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const customTableDefs = pgTable('custom_table_defs', {
  id: uuid('id').defaultRandom().primaryKey(),
  // URL/API-safe slug, e.g. "products", "team-members".
  name: text('name').notNull().unique(),
  label: text('label').notNull(),
  // Marks this table's rows as sellable — the commerce module runs entirely through
  // this generic engine, there is no separate products table.
  isCommerce: boolean('is_commerce').notNull().default(false),
  icon: text('icon'),
  category: text('category'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CustomTableDef = typeof customTableDefs.$inferSelect;
export type NewCustomTableDef = typeof customTableDefs.$inferInsert;
