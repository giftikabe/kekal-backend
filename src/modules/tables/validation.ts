// src/modules/tables/validation.ts
//
// Generic validator for custom_rows.data, driven entirely by a table's
// custom_field_defs. No table or field is ever named here — this is what
// lets one engine power every admin-created table (see B4 prompt, note 3).
//
// Usage:
//   const result = await validateRowData(fieldDefs, incomingData, { partial: false, db });
//   if (!result.valid) return respondError(c, 422, result.errors);
//   // result.data is the sanitized/coerced object safe to merge into custom_rows.data

import { eq } from "drizzle-orm";
import { customRows } from "../../db/schema/system/customRows";

export type FieldType =
  | "text"
  | "richtext"
  | "number"
  | "price"
  | "image"
  | "gallery"
  | "boolean"
  | "date"
  | "select"
  | "relation";

export interface FieldDef {
  id: number | string;
  key: string;
  label: string;
  type: FieldType;
  is_required: boolean;
  // For "select": { choices: string[] }
  // For "relation": { targetTableId: number | string, multiple?: boolean }
  options: Record<string, unknown> | null;
  order: number;
}

export interface ValidationSuccess {
  valid: true;
  data: Record<string, unknown>;
}

export interface ValidationFailure {
  valid: false;
  errors: Record<string, string>;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

interface ValidateOptions {
  // Partial validation for PATCH: only validate keys present in `data`,
  // and skip required-field checks for keys that are absent.
  partial?: boolean;
  // Needed to verify relation targets and select-target existence.
  db: any;
}

/**
 * Validates & coerces a submitted row payload against a table's field defs.
 * Any key in `data` that doesn't match a known field is dropped silently
 * (keeps custom_rows.data from accumulating stale/unknown keys).
 */
export async function validateRowData(
  fieldDefs: FieldDef[],
  data: Record<string, unknown>,
  { partial = false, db }: ValidateOptions
): Promise<ValidationResult> {
  const errors: Record<string, string> = {};
  const cleaned: Record<string, unknown> = {};

  for (const field of fieldDefs) {
    const present = Object.prototype.hasOwnProperty.call(data, field.key);

    if (!present) {
      if (!partial && field.is_required) {
        errors[field.key] = `${field.label} is required`;
      }
      continue;
    }

    const raw = data[field.key];

    // Allow explicit null to clear an optional field.
    if (raw === null || raw === undefined) {
      if (field.is_required) {
        errors[field.key] = `${field.label} is required`;
      } else {
        cleaned[field.key] = null;
      }
      continue;
    }

    const result = await validateField(field, raw, db);
    if (result.ok) {
      cleaned[field.key] = result.value;
    } else {
      errors[field.key] = result.message;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: cleaned };
}

async function validateField(
  field: FieldDef,
  raw: unknown,
  db: any
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  switch (field.type) {
    case "text":
    case "richtext": {
      if (typeof raw !== "string") {
        return { ok: false, message: `${field.label} must be a string` };
      }
      return { ok: true, value: raw };
    }

    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(n)) {
        return { ok: false, message: `${field.label} must be a number` };
      }
      return { ok: true, value: n };
    }

    case "price": {
      // Shape: { etb: number, usd: number } — see F8 (commerce) contract.
      if (typeof raw !== "object" || raw === null) {
        return { ok: false, message: `${field.label} must be a { etb, usd } object` };
      }
      const { etb, usd } = raw as Record<string, unknown>;
      const etbNum = typeof etb === "number" ? etb : Number(etb);
      const usdNum = typeof usd === "number" ? usd : Number(usd);
      if (Number.isNaN(etbNum) || Number.isNaN(usdNum)) {
        return { ok: false, message: `${field.label} requires numeric etb and usd values` };
      }
      return { ok: true, value: { etb: etbNum, usd: usdNum } };
    }

    case "image": {
      if (typeof raw !== "string" || raw.length === 0) {
        return { ok: false, message: `${field.label} must be an image URL string` };
      }
      return { ok: true, value: raw };
    }

    case "gallery": {
      if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string")) {
        return { ok: false, message: `${field.label} must be an array of image URL strings` };
      }
      return { ok: true, value: raw };
    }

    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true" || raw === "false") return { ok: true, value: raw === "true" };
      return { ok: false, message: `${field.label} must be a boolean` };
    }

    case "date": {
      const d = new Date(raw as string);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, message: `${field.label} must be a valid date` };
      }
      return { ok: true, value: d.toISOString() };
    }

    case "select": {
      const choices = (field.options?.choices as string[] | undefined) ?? [];
      if (typeof raw !== "string" || !choices.includes(raw)) {
        return {
          ok: false,
          message: `${field.label} must be one of: ${choices.join(", ")}`,
        };
      }
      return { ok: true, value: raw };
    }

    case "relation": {
      const targetTableId = field.options?.targetTableId;
      if (targetTableId === undefined || targetTableId === null) {
        return { ok: false, message: `${field.label} has no configured relation target` };
      }

      const multiple = Boolean(field.options?.multiple);
      const ids = multiple ? raw : [raw];

      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number" && typeof id !== "string")) {
        return { ok: false, message: `${field.label} must reference valid row id(s)` };
      }

      // Note: this confirms the row exists, not that it belongs to
      // targetTableId — service.ts scopes the same check by table_id when
      // it validates a full row, so the two together fully cover it.
      for (const id of ids as (number | string)[]) {
        const found = await db
          .select({ id: customRows.id })
          .from(customRows)
          .where(eq(customRows.id, id as any))
          .limit(1);
        if (!found.length) {
          return { ok: false, message: `${field.label} references a row that does not exist (id ${id})` };
        }
      }

      return { ok: true, value: multiple ? ids : ids[0] };
    }

    default:
      return { ok: false, message: `Unknown field type for ${field.label}` };
  }
}
