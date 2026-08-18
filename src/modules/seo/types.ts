// src/modules/seo/types.ts
//
// Shared types for the SEO module. These describe the shapes this module
// consumes from tables owned by earlier parts (B2 schema, B4 custom table
// engine, B5 content API) and produces for storage in `seo_settings`.

export type BrandRecord = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
};

export type PageRecord = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  isSystem: boolean;
};

export type CustomFieldDefRecord = {
  id: string;
  tableId: string;
  key: string;
  label: string;
  type:
    | 'text'
    | 'richtext'
    | 'number'
    | 'price'
    | 'image'
    | 'gallery'
    | 'boolean'
    | 'date'
    | 'select'
    | 'relation';
  isRequired: boolean;
  options: unknown;
  order: number;
};

export type CustomTableDefRecord = {
  id: string;
  name: string;
  label: string;
  isCommerce: boolean;
  icon: string | null;
  category: string | null;
  fields?: CustomFieldDefRecord[];
};

export type CustomRowRecord = {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
};

export type FaqEntry = {
  question: string;
  answer: string;
};

export type GeoBlock = {
  summary: string;
  faq: FaqEntry[];
};

export type StructuredData = {
  // JSON-LD graph entries (Organization/LocalBusiness, Product, BreadcrumbList, ...)
  '@context': 'https://schema.org';
  '@graph': Record<string, unknown>[];
  // Non-schema.org helper block consumed by AI answer engines / GEO tooling.
  geo: GeoBlock;
};

export type GeneratedSeo = {
  title: string;
  description: string;
  keywords: string[];
  structuredData: StructuredData;
};

// Discriminated union covering everything generateSeo() can be asked about.
export type SeoEntityInput =
  | {
      kind: 'page';
      page: PageRecord;
      brand: BrandRecord;
      /** 0 for the homepage, otherwise depth in the nav tree, used for BreadcrumbList. */
      navDepth: number;
      /** Ordered labels from home -> this page, used for BreadcrumbList. */
      breadcrumbTrail: { label: string; slug: string }[];
    }
  | {
      kind: 'row';
      row: CustomRowRecord;
      tableDef: CustomTableDefRecord;
      brand: BrandRecord;
    };

export type SeoSettingsRecord = {
  id: string;
  pageId: string | null;
  customRowId: string | null;
  title: string;
  description: string;
  keywords: string[];
  structuredData: StructuredData;
  isManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
};
