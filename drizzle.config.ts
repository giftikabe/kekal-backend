/**
 * drizzle-kit config, used by `npm run db:generate` / `db:migrate` /
 * `db:studio`. B2 introduces the actual schema files this points at;
 * the path below is where they will live.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // B2 will populate src/db/schema/index.ts (barrel export of every
  // system table). Until then this glob simply matches nothing.
  schema: './src/db/schema/**/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
