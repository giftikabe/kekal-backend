// src/db/client.ts
//
// Exports a factory function `createDb(databaseUrl)` — NOT a singleton.
//
// Cloudflare Workers constraint: env bindings (DATABASE_URL, etc.) are only
// available inside the request handler via `c.env`. They are NOT available at
// module load time, so it is impossible to create a Drizzle instance once at
// the top level and share it. Every route handler must call:
//
//   const db = createDb(c.env.DATABASE_URL);
//
// at the top of the handler function, then use that local `db` for the
// duration of that request. The connection is short-lived per invocation.
//
// For Node scripts (seed.ts, migrations) running outside Workers, process.env
// IS available, so they call createDb(process.env.DATABASE_URL!) directly.

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema/system';

/**
 * Creates a Drizzle ORM instance bound to the given Postgres URL.
 * Call this once per request handler — never at module scope.
 */
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;