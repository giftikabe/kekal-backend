// src/modules/tables/service.ts
import { and, eq, inArray, sql } from "drizzle-orm";
import { customTableDefs } from "../../db/schema/system/customTableDefs";
import { customFieldDefs } from "../../db/schema/system/customFieldDefs";
import { customRows } from "../../db/schema/system/customRows";
import { validateRowData, type FieldDef } from "./validation";

// ---------- Table definitions ----------

export async function listTables(db: any) {
  const tables = await db.select().from(customTableDefs);
  const fields = await db.select().from(customFieldDefs);

  const fieldsByTable = new Map<string | number, any[]>();
  for (const f of fields) {
    const list = fieldsByTable.get(f.tableId) ?? [];
    list.push(f);
    fieldsByTable.set(f.tableId, list);
  }

  return tables.map((t: any) => ({
    ...t,
    fields: (fieldsByTable.get(t.id) ?? []).sort((a, b) => a.order - b.order),
  }));
}

export async function getTable(db: any, tableId: string | number) {
  const [table] = await db
    .select()
    .from(customTableDefs)
    .where(eq(customTableDefs.id, tableId as any))
    .limit(1);
  if (!table) return null;

  const fields = await db
    .select()
    .from(customFieldDefs)
    .where(eq(customFieldDefs.tableId, tableId as any));

  return { ...table, fields: fields.sort((a: any, b: any) => a.order - b.order) };
}

export interface CreateTableInput {
  name: string;
  label: string;
  category?: string | null;
  isCommerce?: boolean;
  icon?: string | null;
  fields: Array<{
    key: string;
    label: string;
    type: FieldDef["type"];
    isRequired?: boolean;
    options?: Record<string, unknown> | null;
    order?: number;
  }>;
}

export async function createTable(db: any, input: CreateTableInput) {
  const [table] = await db
    .insert(customTableDefs)
    .values({
      name: input.name,
      label: input.label,
      category: input.category ?? null,
      isCommerce: input.isCommerce ?? false,
      icon: input.icon ?? null,
    })
    .returning();

  if (input.fields?.length) {
    await db.insert(customFieldDefs).values(
      input.fields.map((f, idx) => ({
        tableId: table.id,
        key: f.key,
        label: f.label,
        type: f.type,
        isRequired: f.isRequired ?? false,
        options: f.options ?? null,
        order: f.order ?? idx,
      }))
    );
  }

  return getTable(db, table.id);
}

export interface UpdateTableInput {
  label?: string;
  category?: string | null;
  isCommerce?: boolean;
  icon?: string | null;
  fields?: Array<{
    id?: number | string;
    key: string;
    label: string;
    type: FieldDef["type"];
    isRequired?: boolean;
    options?: Record<string, unknown> | null;
    order?: number;
  }>;
}

export async function updateTable(db: any, tableId: string | number, input: UpdateTableInput) {
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.category !== undefined) patch.category = input.category;
  if (input.isCommerce !== undefined) patch.isCommerce = input.isCommerce;
  if (input.icon !== undefined) patch.icon = input.icon;

  if (Object.keys(patch).length > 0) {
    await db.update(customTableDefs).set(patch).where(eq(customTableDefs.id, tableId as any));
  }

  if (input.fields) {
    const existing = await db
      .select({ id: customFieldDefs.id })
      .from(customFieldDefs)
      .where(eq(customFieldDefs.tableId, tableId as any));
    const existingIds = new Set<string | number>(existing.map((f: any) => f.id));
    const keepIds = new Set<string | number>(
      input.fields.filter((f) => f.id !== undefined).map((f) => f.id as string | number)
    );

    const toRemove = [...existingIds].filter((id) => !keepIds.has(id));
    if (toRemove.length) {
      await db.delete(customFieldDefs).where(inArray(customFieldDefs.id, toRemove as any));
    }

    for (const [idx, f] of input.fields.entries()) {
      if (f.id !== undefined && existingIds.has(f.id)) {
        await db
          .update(customFieldDefs)
          .set({
            key: f.key,
            label: f.label,
            type: f.type,
            isRequired: f.isRequired ?? false,
            options: f.options ?? null,
            order: f.order ?? idx,
          })
          .where(eq(customFieldDefs.id, f.id as any));
      } else {
        await db.insert(customFieldDefs).values({
          tableId: tableId,
          key: f.key,
          label: f.label,
          type: f.type,
          isRequired: f.isRequired ?? false,
          options: f.options ?? null,
          order: f.order ?? idx,
        });
      }
    }
  }

  return getTable(db, tableId);
}

export async function deleteTable(db: any, tableId: string | number) {
  await db.delete(customRows).where(eq(customRows.tableId, tableId as any));
  await db.delete(customFieldDefs).where(eq(customFieldDefs.tableId, tableId as any));
  await db.delete(customTableDefs).where(eq(customTableDefs.id, tableId as any));
}

// ---------- Rows ----------

const DEFAULT_PAGE_SIZE = 25;

export async function listRows(
  db: any,
  tableId: string | number,
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: { page?: number; pageSize?: number } = {}
) {
  const table = await getTable(db, tableId);
  if (!table) return null;

  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(customRows)
      .where(eq(customRows.tableId, tableId as any))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customRows)
      .where(eq(customRows.tableId, tableId as any)),
  ]);

  const total = countRows[0]?.count ?? 0;
  const resolved = await resolveRelations(db, table.fields, rows);

  return { rows: resolved, total, page, pageSize };
}

export async function getRow(db: any, tableId: string | number, rowId: string | number) {
  const table = await getTable(db, tableId);
  if (!table) return { table: null, row: null };

  const [row] = await db
    .select()
    .from(customRows)
    .where(and(eq(customRows.tableId, tableId as any), eq(customRows.id, rowId as any)))
    .limit(1);
  if (!row) return { table, row: null };

  const [resolved] = await resolveRelations(db, table.fields, [row]);
  return { table, row: resolved };
}

export type RowMutationResult =
  | { ok: true; row: any }
  | { ok: false; status: 404 | 422; errors?: Record<string, string> };

export async function createRow(
  db: any,
  tableId: string | number,
  data: Record<string, unknown>
): Promise<RowMutationResult> {
  const table = await getTable(db, tableId);
  if (!table) return { ok: false, status: 404 };

  const result = await validateRowData(table.fields as FieldDef[], data, { db });
  if (!result.valid) return { ok: false, status: 422, errors: result.errors };

  const [row] = await db
    .insert(customRows)
    .values({ tableId: tableId, data: result.data })
    .returning();

  return { ok: true, row };
}

export async function updateRow(
  db: any,
  tableId: string | number,
  rowId: string | number,
  patch: Record<string, unknown>
): Promise<RowMutationResult> {
  const table = await getTable(db, tableId);
  if (!table) return { ok: false, status: 404 };

  const [existing] = await db
    .select()
    .from(customRows)
    .where(and(eq(customRows.tableId, tableId as any), eq(customRows.id, rowId as any)))
    .limit(1);
  if (!existing) return { ok: false, status: 404 };

  const result = await validateRowData(table.fields as FieldDef[], patch, { db, partial: true });
  if (!result.valid) return { ok: false, status: 422, errors: result.errors };

  const mergedData = { ...(existing.data as Record<string, unknown>), ...result.data };

  const [row] = await db
    .update(customRows)
    .set({ data: mergedData, updatedAt: new Date() })
    .where(eq(customRows.id, rowId as any))
    .returning();

  return { ok: true, row };
}

export async function deleteRow(db: any, tableId: string | number, rowId: string | number) {
  const [existing] = await db
    .select({ id: customRows.id })
    .from(customRows)
    .where(and(eq(customRows.tableId, tableId as any), eq(customRows.id, rowId as any)))
    .limit(1);
  if (!existing) return false;

  await db.delete(customRows).where(eq(customRows.id, rowId as any));
  return true;
}

// ---------- Relation resolution ----------

async function resolveRelations(db: any, fields: FieldDef[], rows: any[]) {
  const relationFields = fields.filter((f) => f.type === "relation");
  if (!relationFields.length || !rows.length) return rows;

  const idsToFetch = new Set<string | number>();
  for (const row of rows) {
    for (const field of relationFields) {
      const value = row.data?.[field.key];
      if (value === undefined || value === null) continue;
      const multiple = Boolean(field.options?.multiple);
      const ids = multiple ? value : [value];
      for (const id of ids as (string | number)[]) idsToFetch.add(id);
    }
  }

  if (!idsToFetch.size) return rows;

  const referenced = await db
    .select()
    .from(customRows)
    .where(inArray(customRows.id, [...idsToFetch] as any));
  const byId = new Map(referenced.map((r: any) => [r.id, r]));

  return rows.map((row) => {
    const out = { ...row, data: { ...row.data } };
    for (const field of relationFields) {
      const value = row.data?.[field.key];
      if (value === undefined || value === null) continue;
      const multiple = Boolean(field.options?.multiple);

      if (multiple) {
        out.data[field.key] = (value as (string | number)[]).map((id) => byId.get(id)).filter(Boolean);
      } else {
        out.data[field.key] = byId.get(value as string | number) ?? null;
      }
    }
    return out;
  });
}