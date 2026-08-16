# kekal-backend

Hono API for Kekal Living, deployed to Cloudflare Workers, using Drizzle ORM
against PostgreSQL (via the Neon serverless HTTP driver — see the comment
in `src/db/client.ts` for why).

## Status

This is the **B1 — Project Foundation** part of the build series: just the
runnable skeleton (app entry, error handling, response helpers, DB client
wiring, deploy config). No schema, auth, or business logic yet — those
arrive in B2 onward and plug into this skeleton via `app.route(...)` in
`src/index.ts`.

## Run locally

```bash
npm install
cp .env.example .env   # fill in a real DATABASE_URL at minimum
npm run dev             # starts wrangler dev, defaults to http://localhost:8787
```

Check it's alive:

```bash
curl http://localhost:8787/health
# { "data": { "status": "ok", "service": "kekal-backend" } }
```

## Environment variables

Declared as placeholders in `wrangler.toml` `[vars]` and mirrored in
`.env.example`:

| Variable            | Used by                          |
|---------------------|-----------------------------------|
| `DATABASE_URL`       | `src/db/client.ts` (Drizzle/Postgres) |
| `JWT_SECRET`         | auth module (B3)                  |
| `CLOUDINARY_URL`     | media module (B6)                 |
| `CHAPA_SECRET_KEY`   | commerce module (B8)              |
| `GITHUB_TOKEN`       | publish module (B9)               |

For local dev, editing `wrangler.toml [vars]` is enough. For deployed
environments, set real secrets instead of committing them:

```bash
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put CLOUDINARY_URL
wrangler secret put CHAPA_SECRET_KEY
wrangler secret put GITHUB_TOKEN
```

## Deploy

```bash
npm run deploy              # default environment
npm run deploy:staging      # [env.staging] in wrangler.toml
npm run deploy:production   # [env.production] in wrangler.toml
```

## Database migrations

Once B2 adds schema files under `src/db/schema/`:

```bash
npm run db:generate   # generate a migration from schema changes
npm run db:migrate    # apply migrations
npm run db:studio     # browse the DB in Drizzle Studio
```

## Adding a new module (B3+)

`src/index.ts` is designed to not need edits beyond one line per module.
Each module exports its own router; mount it inside `mountRoutes()`:

```ts
import { authRouter } from './modules/auth/router';
app.route('/api/auth', authRouter);
```

Errors thrown anywhere (including inside modules) are caught centrally by
`src/middleware/errorHandler.ts` and returned as
`{ error: { message, code } }`. Successful responses should use the
helpers in `src/lib/response.ts` (`ok`, `created`, `noContent`, `fail`) so
every endpoint returns the same shape.
# kekal-backend
