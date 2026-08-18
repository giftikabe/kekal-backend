import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const adminRoleEnum = pgEnum('admin_role', ['super_admin', 'editor']);

export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: adminRoleEnum('role').notNull().default('editor'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
