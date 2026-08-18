import { pgTable, uuid, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { customTableDefs } from './customTableDefs';

export const customRows = pgTable('custom_rows', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableId: uuid('table_id').notNull().references(() => customTableDefs.id, { onDelete: 'cascade' }),
  // Holds the actual field values keyed by the owning table's field defs (custom_field_defs.key).
  // The table itself stays virtual — there is no physical Postgres table per custom_table_defs row.
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tableIdIdx: index('custom_rows_table_id_idx').on(table.tableId),
}));

export type CustomRow = typeof customRows.$inferSelect;
export type NewCustomRow = typeof customRows.$inferInsert;
