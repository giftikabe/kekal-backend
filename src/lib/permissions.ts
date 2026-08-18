// src/lib/permissions.ts
//
// requireRole (src/middleware/requireRole.ts, from B3) gates whole routes
// by role. This file provides finer-grained capability checks for use
// *inside* route handlers when a route is shared by both roles but a
// specific action within it should be restricted further.

export type AdminRole = "super_admin" | "editor";

export const PERMISSIONS = {
  MANAGE_ADMINS: "admins:manage",
  MANAGE_COMMERCE_KEYS: "commerce:manage_keys",
  MANAGE_ORDERS: "commerce:manage_orders",
  DELETE_CUSTOM_TABLE: "tables:delete",
  MANAGE_TABLE_SCHEMA: "tables:manage_schema",
  EDIT_ROWS: "tables:edit_rows",
  MANAGE_PAGES: "pages:manage",
  PUBLISH: "publish:run",
  MANAGE_BRAND: "brand:manage",
  MANAGE_SEO: "seo:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Only list what each role CAN do — anything not listed is denied by default.
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  editor: [
    PERMISSIONS.MANAGE_TABLE_SCHEMA,
    PERMISSIONS.EDIT_ROWS,
    PERMISSIONS.MANAGE_PAGES,
    PERMISSIONS.PUBLISH,
    PERMISSIONS.MANAGE_BRAND,
    PERMISSIONS.MANAGE_SEO,
    // Deliberately excluded for editor: MANAGE_ADMINS, MANAGE_COMMERCE_KEYS,
    // MANAGE_ORDERS, DELETE_CUSTOM_TABLE — these stay super_admin-only per
    // the architecture (commerce keys + admin management are sensitive;
    // table deletion is destructive).
  ],
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Throws-style guard for use inside a handler after requireAuth has run,
 * e.g.: assertPermission(c.get("role"), PERMISSIONS.DELETE_CUSTOM_TABLE)
 * Pair with your existing error response helper (src/lib/response.ts) to
 * return a 403 when this returns false — left as a boolean rather than a
 * thrown error so it fits whatever error-handling pattern B1 established.
 */
export function assertPermission(role: AdminRole, permission: Permission): boolean {
  return hasPermission(role, permission);
}
