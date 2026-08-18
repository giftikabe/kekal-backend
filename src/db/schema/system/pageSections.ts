import { pgTable, uuid, integer, index } from 'drizzle-orm/pg-core';
import { pages } from './pages';
import { componentInstances } from './componentInstances';

export const pageSections = pgTable('page_sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  pageId: uuid('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  componentInstanceId: uuid('component_instance_id')
    .notNull()
    .references(() => componentInstances.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
}, (table) => ({
  pageIdIdx: index('page_sections_page_id_idx').on(table.pageId),
}));

export type PageSection = typeof pageSections.$inferSelect;
export type NewPageSection = typeof pageSections.$inferInsert;
