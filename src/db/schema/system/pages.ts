import { pgTable, uuid, text, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';

export const pageStatusEnum = pgEnum('page_status', ['draft', 'published']);

export const pages = pgTable('pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  status: pageStatusEnum('status').notNull().default('draft'),
  // System pages (cart, checkout, return-policy, shipment-info, etc.) are seeded at
  // build time and can't be deleted from the admin UI the way admin-created pages can.
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx: index('pages_slug_idx').on(table.slug),
}));

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
