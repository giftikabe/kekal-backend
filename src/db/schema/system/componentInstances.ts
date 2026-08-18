import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const componentInstances = pgTable('component_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Not a foreign key on purpose: this is a string identifier resolved at render time
  // against the frontend's componentRegistry (src/shared/componentLibrary/registry.ts).
  componentKey: text('component_key').notNull(),
  // Describes which custom table/filter/row feeds this instance. Null = use the
  // component's own previewProps placeholder data. Shape (informal):
  // { tableId: string, mode: 'single' | 'list', filter?: unknown, rowId?: string }
  dataBinding: jsonb('data_binding'),
  styleOverrides: jsonb('style_overrides'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ComponentInstance = typeof componentInstances.$inferSelect;
export type NewComponentInstance = typeof componentInstances.$inferInsert;
