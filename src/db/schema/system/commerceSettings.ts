import { pgTable, uuid, boolean, text, timestamp } from 'drizzle-orm/pg-core';

// Single-row table, same convention as brand: the commerce module's service layer
// enforces a single row (upsert on write).
//
// chapa_secret_key is sensitive. This column stores it encrypted at the application
// layer (see src/modules/commerce/service.ts, B8) — the schema does not enforce
// encryption itself, so never select this column into a response without redacting it.
export const commerceSettings = pgTable('commerce_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  isActive: boolean('is_active').notNull().default(false),
  chapaPublicKey: text('chapa_public_key'),
  chapaSecretKey: text('chapa_secret_key'),
  webhookUrl: text('webhook_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CommerceSetting = typeof commerceSettings.$inferSelect;
export type NewCommerceSetting = typeof commerceSettings.$inferInsert;
