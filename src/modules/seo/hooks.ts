import type { Database } from '../../db/client';
import { autoGenerateForPage, autoGenerateForRow } from './service';

export async function onPageCreated(db: Database, pageId: string): Promise<void> {
  try {
    await autoGenerateForPage(db, pageId);
  } catch (err) {
    console.error(`[seo] failed to auto-generate SEO for page ${pageId}:`, err);
  }
}

export async function onCustomRowCreated(db: Database, rowId: string, isCommerceTable: boolean): Promise<void> {
  if (!isCommerceTable) return;
  try {
    await autoGenerateForRow(db, rowId);
  } catch (err) {
    console.error(`[seo] failed to auto-generate SEO for row ${rowId}:`, err);
  }
}