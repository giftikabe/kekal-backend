import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { pages, nav, pageSections, componentInstances } from '../../db/schema/system';
import type { CreateSectionInput, UpdateSectionInstanceInput } from './validation';

export async function listPages(db: Database) {
  return db.select().from(pages).orderBy(asc(pages.createdAt));
}

export async function createPage(db: Database, input: { slug: string; title: string }) {
  return db.transaction(async (tx: any) => {
    const [page] = await tx
      .insert(pages)
      .values({ slug: input.slug, title: input.title, status: 'draft', isSystem: false })
      .returning();

    const existingNav: { order: number }[] = await tx.select({ order: nav.order }).from(nav);
    const nextOrder = existingNav.length > 0 ? Math.max(...existingNav.map((n) => n.order)) + 1 : 0;

    const [navEntry] = await tx
      .insert(nav)
      .values({ label: input.title, pageId: page.id, order: nextOrder })
      .returning();

    return { page, navEntry };
  });
}

export async function getPageBySlug(db: Database, slug: string) {
  const [page] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  if (!page) return null;

  const sections = await db
    .select({
      id: pageSections.id,
      order: pageSections.order,
      componentInstance: {
        id: componentInstances.id,
        componentKey: componentInstances.componentKey,
        dataBinding: componentInstances.dataBinding,
        styleOverrides: componentInstances.styleOverrides,
      },
    })
    .from(pageSections)
    .innerJoin(componentInstances, eq(pageSections.componentInstanceId, componentInstances.id))
    .where(eq(pageSections.pageId, page.id))
    .orderBy(asc(pageSections.order));

  return { page, sections };
}

/**
 * Admin equivalent of getPageBySlug, but looked up by primary key instead of
 * slug. Added because the Page Builder frontend (src/admin/components/PageBuilder/api.ts,
 * fetchPageById) calls GET /api/pages/id/:id, which previously had no matching
 * backend route at all (404 on every open of the builder).
 */
export async function getPageDetailById(db: Database, id: string) {
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) return null;

  const sections = await db
    .select({
      id: pageSections.id,
      order: pageSections.order,
      componentInstance: {
        id: componentInstances.id,
        componentKey: componentInstances.componentKey,
        dataBinding: componentInstances.dataBinding,
        styleOverrides: componentInstances.styleOverrides,
      },
    })
    .from(pageSections)
    .innerJoin(componentInstances, eq(pageSections.componentInstanceId, componentInstances.id))
    .where(eq(pageSections.pageId, page.id))
    .orderBy(asc(pageSections.order));

  return { page, sections };
}

export async function getPageById(db: Database, id: string) {
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  return page ?? null;
}

export async function updatePage(db: Database, id: string, patch: { title?: string; status?: 'draft' | 'published' }) {
  const [updated] = await db.update(pages).set({ ...patch, updatedAt: new Date() }).where(eq(pages.id, id)).returning();
  return updated ?? null;
}

export async function deletePage(
  db: Database,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: 'is_system' | 'not_found' }> {
  const page = await getPageById(db, id);
  if (!page) return { ok: false, reason: 'not_found' };
  if (page.isSystem) return { ok: false, reason: 'is_system' };

  await db.transaction(async (tx: any) => {
    const sections = await tx.select().from(pageSections).where(eq(pageSections.pageId, id));
    const instanceIds = sections.map((s: { componentInstanceId: string }) => s.componentInstanceId);

    await tx.delete(pageSections).where(eq(pageSections.pageId, id));
    if (instanceIds.length > 0) {
      await tx.delete(componentInstances).where(inArray(componentInstances.id, instanceIds));
    }
    await tx.delete(nav).where(eq(nav.pageId, id));
    await tx.delete(pages).where(eq(pages.id, id));
  });

  return { ok: true };
}

export async function addSection(db: Database, pageId: string, input: CreateSectionInput) {
  return db.transaction(async (tx: any) => {
    const [instance] = await tx
      .insert(componentInstances)
      .values({
        componentKey: input.componentKey,
        dataBinding: input.dataBinding ?? null,
        styleOverrides: input.styleOverrides ?? null,
      })
      .returning();

    const existing: { order: number }[] = await tx
      .select({ order: pageSections.order })
      .from(pageSections)
      .where(eq(pageSections.pageId, pageId));
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;

    const [section] = await tx
      .insert(pageSections)
      .values({ pageId, componentInstanceId: instance.id, order: nextOrder })
      .returning();

    return { section, instance };
  });
}

export async function reorderSections(db: Database, pageId: string, orderedSectionIds: string[]) {
  await db.transaction(async (tx: any) => {
    for (let i = 0; i < orderedSectionIds.length; i++) {
      await tx.update(pageSections).set({ order: i })
        .where(and(eq(pageSections.id, orderedSectionIds[i]), eq(pageSections.pageId, pageId)));
    }
  });
}

export async function updateSectionInstance(db: Database, instanceId: string, patch: UpdateSectionInstanceInput) {
  const [updated] = await db.update(componentInstances).set(patch).where(eq(componentInstances.id, instanceId)).returning();
  return updated ?? null;
}

export async function removeSection(db: Database, pageId: string, sectionId: string) {
  return db.transaction(async (tx: any) => {
    const [section] = await tx
      .select().from(pageSections)
      .where(and(eq(pageSections.id, sectionId), eq(pageSections.pageId, pageId)))
      .limit(1);
    if (!section) return false;

    await tx.delete(pageSections).where(eq(pageSections.id, sectionId));
    await tx.delete(componentInstances).where(eq(componentInstances.id, section.componentInstanceId));
    return true;
  });
}

export async function listNav(db: Database) {
  return db
    .select({ id: nav.id, label: nav.label, order: nav.order, page: { id: pages.id, slug: pages.slug, title: pages.title } })
    .from(nav)
    .innerJoin(pages, eq(nav.pageId, pages.id))
    .orderBy(asc(nav.order));
}

export async function reorderNav(db: Database, orderedNavIds: string[]) {
  await db.transaction(async (tx: any) => {
    for (let i = 0; i < orderedNavIds.length; i++) {
      await tx.update(nav).set({ order: i }).where(eq(nav.id, orderedNavIds[i]));
    }
  });
}

export async function updateNavLabel(db: Database, id: string, label: string) {
  const [updated] = await db.update(nav).set({ label }).where(eq(nav.id, id)).returning();
  return updated ?? null;
}

export async function deleteNavItem(db: Database, id: string) {
  const result = await db.delete(nav).where(eq(nav.id, id)).returning();
  return result.length > 0;
}
