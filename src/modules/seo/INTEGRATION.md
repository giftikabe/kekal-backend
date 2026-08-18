# B7 — SEO Module: integration notes

This part assumes the following already exist in the repo (from B1–B6) and
does not redefine them:

- `src/db/client.ts` — Drizzle client (B1)
- `src/middleware/requireAuth.ts` (B3)
- `src/lib/response.ts` — `successResponse` / `errorResponse` helpers (B1)
- `src/db/schema/system/index.ts` exporting, among others: `seoSettings`,
  `pages`, `nav`, `brand`, `customRows`, `customTableDefs`, `customFieldDefs`
  (B2)

If any exported table/column name in your existing schema differs from what
`service.ts` imports, adjust the imports at the top of `service.ts` to match
— the logic itself doesn't need to change.

## 1. Mount the router

In `src/index.ts`, alongside the other `app.route(...)` calls:

```ts
import { seoRouter } from './modules/seo/router';
// ...
app.route('/api/seo', seoRouter);
```

## 2. Hook into page creation (B5)

In `src/modules/pages/router.ts`, inside the `POST /api/pages` handler,
after the page row is inserted and before the response is sent:

```ts
import { onPageCreated } from '../seo/hooks';
// ...
const [page] = await db.insert(pages).values({ ... }).returning();
await onPageCreated(page.id);
return successResponse(c, page);
```

## 3. Hook into commerce row creation (B4)

In `src/modules/tables/router.ts`, inside the `POST /api/tables/:tableId/rows`
handler, after the row is inserted:

```ts
import { onCustomRowCreated } from '../seo/hooks';
// ...
const [row] = await db.insert(customRows).values({ ... }).returning();
await onCustomRowCreated(row.id, tableDef.isCommerce);
return successResponse(c, row);
```

`onCustomRowCreated` is a no-op for rows in non-commerce tables, so it's safe
to call unconditionally from the generic row-creation handler.

## 4. Env

No new environment variables are required. `service.ts` currently hardcodes
`SITE_URL`; swap it for an env binding (e.g. `c.env.SITE_URL`) if you want it
configurable per environment — trivial once the Hono context is threaded
through to `service.ts`, not done here to keep this module's functions
context-free and easily unit-testable.
