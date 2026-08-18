import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { pages } from './pages';

export const nav = pgTable('nav', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull(),
  pageId: uuid('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pageIdIdx: index('nav_page_id_idx').on(table.pageId),
}));

export type Nav = typeof nav.$inferSelect;
export type NewNav = typeof nav.$inferInsert;
