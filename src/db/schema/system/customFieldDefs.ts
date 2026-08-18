import { pgTable, uuid, text, boolean, jsonb, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { customTableDefs } from './customTableDefs';

export const fieldTypeEnum = pgEnum('field_type', [
  'text',
  'richtext',
  'number',
  'price',
  'image',
  'gallery',
  'boolean',
  'date',
  'select',
  'relation',
]);

export const customFieldDefs = pgTable('custom_field_defs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableId: uuid('table_id').notNull().references(() => customTableDefs.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  label: text('label').notNull(),
  type: fieldTypeEnum('type').notNull(),
  isRequired: boolean('is_required').notNull().default(false),
  // For type "select": { choices: string[] }.
  // For type "relation": { targetTableId: string }.
  options: jsonb('options'),
  order: integer('order').notNull().default(0),
}, (table) => ({
  tableIdIdx: index('custom_field_defs_table_id_idx').on(table.tableId),
}));

export type CustomFieldDef = typeof customFieldDefs.$inferSelect;
export type NewCustomFieldDef = typeof customFieldDefs.$inferInsert;
