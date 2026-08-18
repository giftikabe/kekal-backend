// src/db/seed.ts
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema/system"; // Or your main schema barrel export

// Initialize Drizzle directly for the seeding script using process.env
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

import {
  admins,
  brand,
  commerceSettings,
  pages,
  nav,
  pageSections,
  componentInstances,
  customTableDefs,
  customFieldDefs,
  customRows,
} from "./schema/system";

async function seed() {
  console.log("Seeding Kekal Living demo data...");

  // 1. Admin user
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const [admin] = await db
    .insert(admins)
    .values({
      email: "admin@kekalliving.com",
      passwordHash,
      role: "super_admin",
    })
    .returning();
  console.log("Created admin:", admin.email, "(password: ChangeMe123! — change this after first login)");

  // 2. Brand
  await db.insert(brand).values({
    name: "Kekal",
    tagline: "Kekal Living — timeless pieces, made to last",
    description:
      "Kekal Living is a design-led brand by Kalkidan, creating enduring pieces for everyday living.",
    logoLightUrl: "/logo/KEKAL_logomark_black_on_white.jpg",
    logoDarkUrl: "/logo/KEKAL_logomark_white_on_black.jpg",
    contactEmail: "hello@kekalliving.com",
    contactPhone: "+251900000000",
    contactAddress: "Addis Ababa, Ethiopia",
  });
  console.log("Seeded brand info (replace placeholder logo URLs with real Cloudinary uploads via the dashboard).");

  // 3. Commerce settings — inactive until real Chapa keys are entered via the dashboard
  await db.insert(commerceSettings).values({
    isActive: false,
    chapaPublicKey: null,
    chapaSecretKey: null,
    webhookUrl: null,
  });
  console.log("Seeded commerce_settings (inactive).");

  // 4. Custom tables: Collections + Products
  const [collectionsTable] = await db
    .insert(customTableDefs)
    .values({ name: "collections", label: "Collections", category: "Content", isCommerce: false })
    .returning();

  await db.insert(customFieldDefs).values([
    { tableId: collectionsTable.id, key: "name", label: "Name", type: "text", isRequired: true, order: 1 },
    { tableId: collectionsTable.id, key: "description", label: "Description", type: "richtext", isRequired: false, order: 2 },
    { tableId: collectionsTable.id, key: "cover_image", label: "Cover Image", type: "image", isRequired: false, order: 3 },
  ]);

  const [productsTable] = await db
    .insert(customTableDefs)
    .values({ name: "products", label: "Products", category: "Commerce", isCommerce: true })
    .returning();

  await db.insert(customFieldDefs).values([
    { tableId: productsTable.id, key: "name", label: "Name", type: "text", isRequired: true, order: 1 },
    { tableId: productsTable.id, key: "description", label: "Description", type: "richtext", isRequired: false, order: 2 },
    { tableId: productsTable.id, key: "price", label: "Price", type: "price", isRequired: true, order: 3 },
    { tableId: productsTable.id, key: "image", label: "Image", type: "image", isRequired: false, order: 4 },
    { tableId: productsTable.id, key: "gallery", label: "Gallery", type: "gallery", isRequired: false, order: 5 },
    {
      tableId: productsTable.id,
      key: "collection",
      label: "Collection",
      type: "relation",
      isRequired: false,
      order: 6,
      options: { relationTableId: collectionsTable.id },
    },
  ]);
  console.log("Seeded 'Collections' and 'Products' custom tables with field definitions.");

  // 5. Demo rows
  const [essentialsCollection] = await db
    .insert(customRows)
    .values({
      tableId: collectionsTable.id,
      data: {
        name: "Essentials",
        description: "The foundational Kekal Living collection.",
        cover_image: "https://placehold.co/800x600?text=Essentials",
      },
    })
    .returning();

  await db.insert(customRows).values([
    {
      tableId: productsTable.id,
      data: {
        name: "Kekal Ceramic Vase",
        description: "Hand-finished ceramic vase, part of the Essentials collection.",
        price: { etb: 2500, usd: 45 },
        image: "https://placehold.co/800x800?text=Ceramic+Vase",
        gallery: [],
        collection: essentialsCollection.id,
      },
    },
    {
      tableId: productsTable.id,
      data: {
        name: "Kekal Linen Throw",
        description: "Soft, breathable linen throw for year-round use.",
        price: { etb: 3200, usd: 58 },
        image: "https://placehold.co/800x800?text=Linen+Throw",
        gallery: [],
        collection: essentialsCollection.id,
      },
    },
  ]);
  console.log("Seeded 2 demo products under 'Essentials' collection.");

  // 6. System pages + nav
  const pageSeeds = [
    { slug: "home", title: "Home", isSystem: false },
    { slug: "shop", title: "Shop", isSystem: false },
    { slug: "cart", title: "Cart", isSystem: true },
    { slug: "checkout", title: "Checkout", isSystem: true },
    { slug: "return-policy", title: "Return Policy", isSystem: true },
    { slug: "shipment-info", title: "Shipment Information", isSystem: true },
  ];

  const createdPages: Record<string, string> = {};
  for (const p of pageSeeds) {
    const [row] = await db
      .insert(pages)
      .values({ slug: p.slug, title: p.title, status: "published", isSystem: p.isSystem })
      .returning();
    createdPages[p.slug] = row.id;
  }

  await db.insert(nav).values([
    { label: "Home", pageId: createdPages["home"], order: 1 },
    { label: "Shop", pageId: createdPages["shop"], order: 2 },
  ]);
  console.log("Seeded pages (home, shop, cart, checkout, return-policy, shipment-info) and nav.");

  // 7. A couple of demo sections on the Home page (header + text block)
  const [headerInstance] = await db
    .insert(componentInstances)
    .values({
      componentKey: "header",
      dataBinding: null,
      styleOverrides: null,
    })
    .returning();

  const [textInstance] = await db
    .insert(componentInstances)
    .values({
      componentKey: "textBlock",
      dataBinding: null,
      styleOverrides: null,
    })
    .returning();

  await db.insert(pageSections).values([
    { pageId: createdPages["home"], componentInstanceId: headerInstance.id, order: 1 },
    { pageId: createdPages["home"], componentInstanceId: textInstance.id, order: 2 },
  ]);
  console.log("Seeded a Header + TextBlock section on the Home page (unbound — using component placeholder data).");

  console.log("\nSeed complete.");
  console.log("Login at /admin/login with admin@kekalliving.com / ChangeMe123!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });