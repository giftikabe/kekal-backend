import { z } from 'zod';

// ---- Pages ----

export const createPageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase, hyphen-separated'),
  title: z.string().min(1),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(['draft', 'published']).optional(),
  // is_system is intentionally NOT accepted here — system pages are seeded,
  // not toggled through this route (per B5 spec).
});
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

// ---- Sections / component instances ----

export const createSectionSchema = z.object({
  componentKey: z.string().min(1),
  dataBinding: z
    .object({
      tableId: z.string(),
      mode: z.enum(['single', 'list']),
      filter: z.record(z.any()).optional(),
      rowId: z.string().optional(),
    })
    .nullable()
    .optional(),
  styleOverrides: z.record(z.string()).nullable().optional(),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const reorderSectionsSchema = z.object({
  orderedSectionIds: z.array(z.string()).min(1),
});
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;

export const updateSectionInstanceSchema = z.object({
  dataBinding: z
    .object({
      tableId: z.string(),
      mode: z.enum(['single', 'list']),
      filter: z.record(z.any()).optional(),
      rowId: z.string().optional(),
    })
    .nullable()
    .optional(),
  styleOverrides: z.record(z.string()).nullable().optional(),
});
export type UpdateSectionInstanceInput = z.infer<typeof updateSectionInstanceSchema>;

// ---- Nav ----

export const reorderNavSchema = z.object({
  orderedNavIds: z.array(z.string()).min(1),
});
export type ReorderNavInput = z.infer<typeof reorderNavSchema>;

export const updateNavItemSchema = z.object({
  label: z.string().min(1),
});
export type UpdateNavItemInput = z.infer<typeof updateNavItemSchema>;

// ---- Brand ----

export const updateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logoLightUrl: z.string().url().nullable().optional(),
  logoDarkUrl: z.string().url().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactAddress: z.string().nullable().optional(),
});
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
