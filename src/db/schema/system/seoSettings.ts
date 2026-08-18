import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { pages } from './pages';
import { customRows } from './customRows';

export const seoSettings = pgTable('seo_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Exactly one of pageId / customRowId is expected to be set: page-level SEO vs.
  // entity-level SEO (e.g. an individual product row).
  pageId: uuid('page_id').references(() => pages.id, { onDelete: 'cascade' }),
  customRowId: uuid('custom_row_id').references(() => customRows.id, { onDelete: 'cascade' }),
  title: text('title'),
  description: text('description'),
  keywords: text('keywords').array(),
  structuredData: jsonb('structured_data'),
  isManualOverride: boolean('is_manual_override').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SeoSetting = typeof seoSettings.$inferSelect;
export type NewSeoSetting = typeof seoSettings.$inferInsert;
