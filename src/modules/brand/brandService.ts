import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { brand } from '../../db/schema/system';
import type { UpdateBrandInput } from '../pages/validation';

export async function getBrand(db: Database) {
  const [existing] = await db.select().from(brand).limit(1);
  if (existing) return existing;

  const [seeded] = await db
    .insert(brand)
    .values({
      name: 'Kekal Living',
      tagline: null,
      description: null,
      logoLightUrl: '/logo/KEKAL_logomark_black_on_white.jpg',
      logoDarkUrl: '/logo/KEKAL_logomark_white_on_black.jpg',
      contactEmail: null,
      contactPhone: null,
      contactAddress: null,
    })
    .returning();
  return seeded;
}

export async function updateBrand(db: Database, patch: UpdateBrandInput) {
  const current = await getBrand(db);
  const [updated] = await db.update(brand).set(patch).where(eq(brand.id, current.id)).returning();
  return updated;
}