// src/lib/validators.ts
//
// Generic, reusable validators shared across modules. This is distinct
// from src/modules/tables/validation.ts (B4), which validates custom-row
// data against a table's field defs — these are lower-level helpers used
// anywhere a route needs to sanity-check input before hitting the db.

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidSlug(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // lowercase letters, numbers, hyphens only, no leading/trailing hyphen
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function isValidPrice(value: unknown): value is { etb: number; usd: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.etb === "number" && v.etb >= 0 &&
    typeof v.usd === "number" && v.usd >= 0
  );
}

export function isValidCurrency(value: unknown): value is "etb" | "usd" {
  return value === "etb" || value === "usd";
}

export function isValidCustomerType(value: unknown): value is "local" | "international" {
  return value === "local" || value === "international";
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Parses ?page & ?pageSize query params into safe bounded numbers. */
export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  return { page, pageSize };
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}
