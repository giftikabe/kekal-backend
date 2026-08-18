import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

// Single-row table: the brand module's service layer should enforce that only one
// row ever exists (upsert against the existing row rather than inserting a new one).
export const brand = pgTable('brand', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline'),
  description: text('description'),
  logoLightUrl: text('logo_light_url'),
  logoDarkUrl: text('logo_dark_url'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  contactAddress: text('contact_address'),
});

export type Brand = typeof brand.$inferSelect;
export type NewBrand = typeof brand.$inferInsert;
