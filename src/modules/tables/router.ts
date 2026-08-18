import { Hono } from "hono";
import { createDb } from "../../db/client";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { ok, fail } from "../../lib/response";
import * as tables from "./service";
import type { AppEnv } from "../../types/env";

export const tablesRouter = new Hono<AppEnv>();

// FIXED: the router previously did `tablesRouter.use("*", requireAuth)`,
// which blocked ALL routes including GETs behind a JWT. That meant the
// public storefront (anonymous customers) could never fetch table/row data
// to render bound sections — see Kekal/routes/[slug].tsx. GETs are now
// public; only writes require auth.

tablesRouter.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  return ok(c, await tables.listTables(db));
});

tablesRouter.post("/", requireAuth, requireRole(["super_admin", "editor"]), async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const body = await c.req.json();

  if (!body?.name || !body?.label) return fail(c, "name and label are required", "VALIDATION_ERROR", 422);

  const table = await tables.createTable(db, {
    name: body.name, label: body.label, category: body.category ?? null,
    isCommerce: Boolean(body.isCommerce), icon: body.icon ?? null,
    fields: Array.isArray(body.fields) ? body.fields : [],
  });

  return ok(c, table, 201);
});

tablesRouter.patch("/:id", requireAuth, requireRole(["super_admin", "editor"]), async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await tables.getTable(db, id);
  if (!existing) return fail(c, "Table not found", "NOT_FOUND", 404);

  const updated = await tables.updateTable(db, id, {
    label: body.label, category: body.category, isCommerce: body.isCommerce, icon: body.icon, fields: body.fields,
  });

  return ok(c, updated);
});

tablesRouter.delete("/:id", requireAuth, requireRole(["super_admin", "editor"]), async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const id = c.req.param("id");

  const existing = await tables.getTable(db, id);
  if (!existing) return fail(c, "Table not found", "NOT_FOUND", 404);

  await tables.deleteTable(db, id);
  return ok(c, { deleted: true });
});

tablesRouter.get("/:tableId/rows", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const tableId = c.req.param("tableId");
  const page = Number(c.req.query("page") ?? "1") || 1;
  const pageSize = Number(c.req.query("pageSize") ?? "25") || 25;

  const result = await tables.listRows(db, tableId, { page, pageSize });
  if (!result) return fail(c, "Table not found", "NOT_FOUND", 404);
  return ok(c, result);
});

tablesRouter.get("/:tableId/rows/:rowId", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const { tableId, rowId } = c.req.param();

  const { table, row } = await tables.getRow(db, tableId, rowId);
  if (!table) return fail(c, "Table not found", "NOT_FOUND", 404);
  if (!row) return fail(c, "Row not found", "NOT_FOUND", 404);
  return ok(c, row);
});

tablesRouter.post("/:tableId/rows", requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const tableId = c.req.param("tableId");
  const body = await c.req.json();

  const result = await tables.createRow(db, tableId, body ?? {});
  if (!result.ok) {
    if (result.status === 404) return fail(c, "Table not found", "NOT_FOUND", 404);
    return fail(c, "Validation failed", "VALIDATION_ERROR", 422, result.errors);
  }
  return ok(c, result.row, 201);
});

tablesRouter.patch("/:tableId/rows/:rowId", requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const { tableId, rowId } = c.req.param();
  const body = await c.req.json();

  const result = await tables.updateRow(db, tableId, rowId, body ?? {});
  if (!result.ok) {
    if (result.status === 404) return fail(c, "Table or row not found", "NOT_FOUND", 404);
    return fail(c, "Validation failed", "VALIDATION_ERROR", 422, result.errors);
  }
  return ok(c, result.row);
});

tablesRouter.delete("/:tableId/rows/:rowId", requireAuth, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const { tableId, rowId } = c.req.param();

  const deleted = await tables.deleteRow(db, tableId, rowId);
  if (!deleted) return fail(c, "Row not found", "NOT_FOUND", 404);
  return ok(c, { deleted: true });
});