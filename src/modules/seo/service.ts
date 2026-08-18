import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { seoSettings, pages, nav, brand, customRows, customTableDefs, customFieldDefs } from '../../db/schema/system';
import { generateSeo } from './templateEngine';
import type { BrandRecord, CustomRowRecord, CustomTableDefRecord, GeneratedSeo, PageRecord, SeoSettingsRecord } from './types';

const SITE_URL = 'https://kekalliving.com';

function toBrandRecord(row: typeof brand.$inferSelect): BrandRecord {
  return {
    id: row.id, name: row.name, tagline: row.tagline ?? null, description: row.description ?? null,
    logoLightUrl: row.logoLightUrl ?? null, logoDarkUrl: row.logoDarkUrl ?? null,
    contactEmail: row.contactEmail ?? null, contactPhone: row.contactPhone ?? null, contactAddress: row.contactAddress ?? null,
  };
}

function toPageRecord(row: typeof pages.$inferSelect): PageRecord {
  return { id: row.id, slug: row.slug, title: row.title, status: row.status, isSystem: row.isSystem };
}

function toSeoSettingsRecord(row: typeof seoSettings.$inferSelect): SeoSettingsRecord {
  return {
    id: row.id,
    pageId: row.pageId ?? null,
    customRowId: row.customRowId ?? null,
    title: row.title ?? '',
    description: row.description ?? '',
    keywords: row.keywords ?? [],
    structuredData: row.structuredData as SeoSettingsRecord['structuredData'],
    isManualOverride: row.isManualOverride,
    createdAt: row.createdAt.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt.toISOString?.() ?? String(row.updatedAt),
  };
}

async function getBrand(db: Database): Promise<BrandRecord> {
  const [row] = await db.select().from(brand).limit(1);
  if (!row) throw new Error('Brand settings have not been configured yet');
  return toBrandRecord(row);
}

async function getBreadcrumbContext(db: Database, pageId: string) {
  const navRows = await db.select().from(nav).orderBy(nav.order);
  const homeCrumb = { label: 'Home', slug: '/' };

  const matching = navRows.find((n: typeof nav.$inferSelect) => n.pageId === pageId);
  if (!matching) return { navDepth: 1, breadcrumbTrail: [homeCrumb] };

  const isFirst = navRows[0]?.id === matching.id;
  const trail = isFirst ? [homeCrumb] : [homeCrumb, { label: matching.label, slug: `/${matching.id}` }];
  return { navDepth: isFirst ? 0 : 1, breadcrumbTrail: trail };
}

async function generateForPageId(db: Database, pageId: string): Promise<GeneratedSeo> {
  const [pageRow] = await db.select().from(pages).where(eq(pages.id, pageId));
  if (!pageRow) throw new Error(`Page ${pageId} not found`);

  const brandRecord = await getBrand(db);
  const { navDepth, breadcrumbTrail } = await getBreadcrumbContext(db, pageId);

  return generateSeo({ kind: 'page', page: toPageRecord(pageRow), brand: brandRecord, navDepth, breadcrumbTrail }, SITE_URL);
}

async function generateForRowId(db: Database, rowId: string): Promise<GeneratedSeo> {
  const [rowRow] = await db.select().from(customRows).where(eq(customRows.id, rowId));
  if (!rowRow) throw new Error(`Row ${rowId} not found`);

  const [tableRow] = await db.select().from(customTableDefs).where(eq(customTableDefs.id, rowRow.tableId));
  if (!tableRow) throw new Error(`Table def ${rowRow.tableId} not found`);

  const fieldRows = await db.select().from(customFieldDefs).where(eq(customFieldDefs.tableId, tableRow.id));

  const tableDef: CustomTableDefRecord = {
    id: tableRow.id, name: tableRow.name, label: tableRow.label, isCommerce: tableRow.isCommerce,
    icon: tableRow.icon ?? null, category: tableRow.category ?? null,
    fields: fieldRows.map((f: typeof customFieldDefs.$inferSelect) => ({
      id: f.id, tableId: f.tableId, key: f.key, label: f.label, type: f.type, isRequired: f.isRequired, options: f.options, order: f.order,
    })),
  };

  const rowRecord: CustomRowRecord = { id: rowRow.id, tableId: rowRow.tableId, data: (rowRow.data ?? {}) as Record<string, unknown> };
  const brandRecord = await getBrand(db);

  return generateSeo({ kind: 'row', row: rowRecord, tableDef, brand: brandRecord }, SITE_URL);
}

export async function autoGenerateForPage(db: Database, pageId: string): Promise<SeoSettingsRecord> {
  const generated = await generateForPageId(db, pageId);
  const [existing] = await db.select().from(seoSettings).where(eq(seoSettings.pageId, pageId));
  if (existing?.isManualOverride) return toSeoSettingsRecord(existing);

  if (existing) {
    const [updated] = await db.update(seoSettings).set({
      title: generated.title, description: generated.description, keywords: generated.keywords,
      structuredData: generated.structuredData, updatedAt: new Date(),
    }).where(eq(seoSettings.id, existing.id)).returning();
    return toSeoSettingsRecord(updated);
  }

  const [created] = await db.insert(seoSettings).values({
    pageId, customRowId: null, title: generated.title, description: generated.description,
    keywords: generated.keywords, structuredData: generated.structuredData, isManualOverride: false,
  }).returning();
  return toSeoSettingsRecord(created);
}

export async function autoGenerateForRow(db: Database, rowId: string): Promise<SeoSettingsRecord> {
  const generated = await generateForRowId(db, rowId);
  const [existing] = await db.select().from(seoSettings).where(eq(seoSettings.customRowId, rowId));
  if (existing?.isManualOverride) return toSeoSettingsRecord(existing);

  if (existing) {
    const [updated] = await db.update(seoSettings).set({
      title: generated.title, description: generated.description, keywords: generated.keywords,
      structuredData: generated.structuredData, updatedAt: new Date(),
    }).where(eq(seoSettings.id, existing.id)).returning();
    return toSeoSettingsRecord(updated);
  }

  const [created] = await db.insert(seoSettings).values({
    pageId: null, customRowId: rowId, title: generated.title, description: generated.description,
    keywords: generated.keywords, structuredData: generated.structuredData, isManualOverride: false,
  }).returning();
  return toSeoSettingsRecord(created);
}

export async function getSeoByPageId(db: Database, pageId: string): Promise<SeoSettingsRecord | null> {
  const [row] = await db.select().from(seoSettings).where(eq(seoSettings.pageId, pageId));
  return row ? toSeoSettingsRecord(row) : null;
}

export async function getSeoByRowId(db: Database, rowId: string): Promise<SeoSettingsRecord | null> {
  const [row] = await db.select().from(seoSettings).where(eq(seoSettings.customRowId, rowId));
  return row ? toSeoSettingsRecord(row) : null;
}

export async function getSeoById(db: Database, id: string): Promise<SeoSettingsRecord | null> {
  const [row] = await db.select().from(seoSettings).where(eq(seoSettings.id, id));
  return row ? toSeoSettingsRecord(row) : null;
}

export type ManualSeoPatch = Partial<{ title: string; description: string; keywords: string[]; structuredData: SeoSettingsRecord['structuredData']; }>;

export async function applyManualOverride(db: Database, id: string, patch: ManualSeoPatch): Promise<SeoSettingsRecord | null> {
  const [updated] = await db.update(seoSettings).set({ ...patch, isManualOverride: true, updatedAt: new Date() }).where(eq(seoSettings.id, id)).returning();
  return updated ? toSeoSettingsRecord(updated) : null;
}

export async function regenerate(db: Database, id: string): Promise<SeoSettingsRecord | null> {
  const [existing] = await db.select().from(seoSettings).where(eq(seoSettings.id, id));
  if (!existing) return null;

  const generated = existing.pageId
    ? await generateForPageId(db, existing.pageId)
    : existing.customRowId ? await generateForRowId(db, existing.customRowId) : null;
  if (!generated) return null;

  const [updated] = await db.update(seoSettings).set({
    title: generated.title, description: generated.description, keywords: generated.keywords,
    structuredData: generated.structuredData, isManualOverride: false, updatedAt: new Date(),
  }).where(eq(seoSettings.id, id)).returning();
  return updated ? toSeoSettingsRecord(updated) : null;
}

export async function getPublicSeoBySlug(db: Database, slug: string): Promise<SeoSettingsRecord | null> {
  const [pageRow] = await db.select().from(pages).where(eq(pages.slug, slug));
  if (!pageRow) return null;
  const [seoRow] = await db.select().from(seoSettings).where(and(eq(seoSettings.pageId, pageRow.id), isNull(seoSettings.customRowId)));
  return seoRow ? toSeoSettingsRecord(seoRow) : null;
}

/**
 * Admin list view (SEO settings dashboard). Auto-creates a row's SEO record
 * on first list if one doesn't exist yet, mirroring auto-generation on page
 * creation, so the admin screen isn't empty for pages created before B7.
 * Returns page title/slug joined in, since the frontend table needs them
 * and there is otherwise no endpoint that returns "all SEO settings" at all.
 */
export async function listAllPageSeo(
  db: Database,
): Promise<Array<SeoSettingsRecord & { pageLabel: string; pageSlug: string }>> {
  const allPages = await db.select().from(pages);
  const results: Array<SeoSettingsRecord & { pageLabel: string; pageSlug: string }> = [];

  for (const pageRow of allPages) {
    let record = await getSeoByPageId(db, pageRow.id);
    if (!record) {
      try {
        record = await autoGenerateForPage(db, pageRow.id);
      } catch {
        continue; // brand not configured yet, etc — skip rather than error the whole list
      }
    }
    results.push({ ...record, pageLabel: pageRow.title, pageSlug: pageRow.slug });
  }

  return results;
}
