// src/modules/seo/templateEngine.ts
//
// Template-driven SEO/GEO generator. generateSeo() is the single function
// every auto-generation path (page creation in B5, commerce row creation in
// B4) and every manual "Regenerate" admin action funnels through, so title/
// description/keyword conventions never drift between call sites.

import type {
  BrandRecord,
  CustomRowRecord,
  CustomTableDefRecord,
  FaqEntry,
  GeneratedSeo,
  PageRecord,
  SeoEntityInput,
  StructuredData,
} from './types';

// Always woven into keywords[] and, where it reads naturally, into the
// description — per product requirement.
const BRAND_KEYWORDS = ['Kekal', 'Kekal Living', 'Kalkidan'];

/** Field keys we try, in order, when pulling a human title out of a row's jsonb data. */
const TITLE_FIELD_CANDIDATES = ['title', 'name', 'label'];
/** Field keys we try, in order, when pulling a human description out of a row's jsonb data. */
const DESCRIPTION_FIELD_CANDIDATES = ['description', 'summary', 'excerpt'];
/** Field key convention for a price field (shape { etb: number, usd: number }) per B4/B8. */
const PRICE_FIELD_CANDIDATES = ['price'];
/** Field key convention for a primary image, used as the schema.org image. */
const IMAGE_FIELD_CANDIDATES = ['image', 'gallery', 'photo'];

function firstStringField(data: Record<string, unknown>, candidates: string[]): string | null {
  for (const key of candidates) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function firstImageField(data: Record<string, unknown>, candidates: string[]): string | null {
  for (const key of candidates) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  }
  return null;
}

function firstPriceField(
  data: Record<string, unknown>,
  candidates: string[],
): { etb?: number; usd?: number } | null {
  for (const key of candidates) {
    const value = data[key];
    if (value && typeof value === 'object') {
      const price = value as Record<string, unknown>;
      if (typeof price.etb === 'number' || typeof price.usd === 'number') {
        return { etb: price.etb as number | undefined, usd: price.usd as number | undefined };
      }
    }
  }
  return null;
}

/** Truncates on a word boundary and appends an ellipsis if truncated. */
function clip(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function weaveKeywords(base: string[], extra: string[]): string[] {
  return dedupe([...base, ...BRAND_KEYWORDS, ...extra]);
}

// --- structured_data builders ------------------------------------------------

function buildOrganizationSchema(brand: BrandRecord, siteUrl: string): Record<string, unknown> {
  return {
    '@type': 'Organization',
    name: brand.name,
    description: brand.description ?? brand.tagline ?? undefined,
    url: siteUrl,
    logo: brand.logoLightUrl ?? undefined,
    email: brand.contactEmail ?? undefined,
    telephone: brand.contactPhone ?? undefined,
    address: brand.contactAddress
      ? { '@type': 'PostalAddress', streetAddress: brand.contactAddress }
      : undefined,
  };
}

function buildLocalBusinessSchema(brand: BrandRecord, siteUrl: string): Record<string, unknown> {
  return {
    '@type': 'LocalBusiness',
    name: brand.name,
    description: brand.description ?? brand.tagline ?? undefined,
    url: siteUrl,
    image: brand.logoLightUrl ?? undefined,
    email: brand.contactEmail ?? undefined,
    telephone: brand.contactPhone ?? undefined,
    address: brand.contactAddress
      ? { '@type': 'PostalAddress', streetAddress: brand.contactAddress }
      : undefined,
  };
}

function buildProductSchema(
  row: CustomRowRecord,
  tableDef: CustomTableDefRecord,
  title: string,
  description: string,
  brand: BrandRecord,
): Record<string, unknown> {
  const image = firstImageField(row.data, IMAGE_FIELD_CANDIDATES);
  const price = firstPriceField(row.data, PRICE_FIELD_CANDIDATES);

  const offers: Record<string, unknown>[] = [];
  if (price?.etb !== undefined) {
    offers.push({ '@type': 'Offer', price: price.etb, priceCurrency: 'ETB' });
  }
  if (price?.usd !== undefined) {
    offers.push({ '@type': 'Offer', price: price.usd, priceCurrency: 'USD' });
  }

  return {
    '@type': 'Product',
    name: title,
    description,
    image: image ?? undefined,
    brand: { '@type': 'Brand', name: brand.name },
    category: tableDef.label,
    offers: offers.length > 0 ? offers : undefined,
  };
}

function buildBreadcrumbSchema(
  trail: { label: string; slug: string }[],
  siteUrl: string,
): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: `${siteUrl}${crumb.slug === '/' ? '' : `/${crumb.slug.replace(/^\//, '')}`}`,
    })),
  };
}

function buildGeoBlock(opts: {
  entityName: string;
  brand: BrandRecord;
  description: string;
  isCommerceProduct: boolean;
  price?: { etb?: number; usd?: number } | null;
}): { summary: string; faq: FaqEntry[] } {
  const { entityName, brand, description, isCommerceProduct, price } = opts;

  const summaryParts = [
    `${entityName} is offered by ${brand.name}${brand.tagline ? `, ${brand.tagline}` : ''}.`,
    description,
  ];
  if (isCommerceProduct && price) {
    const priceBits: string[] = [];
    if (price.etb !== undefined) priceBits.push(`${price.etb} ETB`);
    if (price.usd !== undefined) priceBits.push(`${price.usd} USD`);
    if (priceBits.length > 0) {
      summaryParts.push(`It is priced at ${priceBits.join(' or ')}.`);
    }
  }
  const summary = clip(summaryParts.filter(Boolean).join(' '), 480);

  const faq: FaqEntry[] = [
    {
      question: `What is ${entityName}?`,
      answer: clip(description || `${entityName} from ${brand.name}.`, 280),
    },
    {
      question: `Who makes ${entityName}?`,
      answer: `${entityName} is offered by ${brand.name}${
        brand.tagline ? `, ${brand.tagline}.` : '.'
      }`,
    },
  ];
  if (isCommerceProduct && price) {
    const priceBits: string[] = [];
    if (price.etb !== undefined) priceBits.push(`${price.etb} ETB`);
    if (price.usd !== undefined) priceBits.push(`${price.usd} USD`);
    if (priceBits.length > 0) {
      faq.push({
        question: `How much does ${entityName} cost?`,
        answer: `${entityName} is priced at ${priceBits.join(' or ')}.`,
      });
    }
  }

  return { summary, faq };
}

// --- entity-specific generation ----------------------------------------------

function generateForPage(
  page: PageRecord,
  brand: BrandRecord,
  navDepth: number,
  breadcrumbTrail: { label: string; slug: string }[],
  siteUrl: string,
): GeneratedSeo {
  const isHome = navDepth === 0 || page.slug === '/' || page.slug === 'home';

  const title = isHome ? brand.name : `${page.title} | ${brand.name}`;

  const baseDescription =
    brand.description ?? brand.tagline ?? `${brand.name} — quality living, thoughtfully made.`;
  const description = clip(
    isHome
      ? `${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ''}. ${baseDescription}`
      : `${page.title} at ${brand.name}. ${baseDescription}`,
    300,
  );

  const keywords = weaveKeywords(
    [page.title, brand.name].filter((v): v is string => Boolean(v)),
    [],
  );

  const graph: Record<string, unknown>[] = [];
  if (isHome) {
    graph.push(buildLocalBusinessSchema(brand, siteUrl));
    graph.push(buildOrganizationSchema(brand, siteUrl));
  }
  if (breadcrumbTrail.length > 0) {
    graph.push(buildBreadcrumbSchema(breadcrumbTrail, siteUrl));
  }

  const geo = buildGeoBlock({
    entityName: isHome ? brand.name : page.title,
    brand,
    description: baseDescription,
    isCommerceProduct: false,
  });

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@graph': graph,
    geo,
  };

  return { title, description, keywords, structuredData };
}

function generateForRow(
  row: CustomRowRecord,
  tableDef: CustomTableDefRecord,
  brand: BrandRecord,
  _siteUrl: string,
): GeneratedSeo {
  const entityName =
    firstStringField(row.data, TITLE_FIELD_CANDIDATES) ?? `${tableDef.label} item`;
  const rawDescription =
    firstStringField(row.data, DESCRIPTION_FIELD_CANDIDATES) ??
    `A ${tableDef.label.toLowerCase()} from ${brand.name}.`;
  const price = firstPriceField(row.data, PRICE_FIELD_CANDIDATES);

  const title = `${entityName} | ${brand.name}`;
  const description = clip(`${rawDescription} Available from ${brand.name}.`, 300);

  const keywords = weaveKeywords([entityName, tableDef.label, brand.name], []);

  const graph: Record<string, unknown>[] = [];
  if (tableDef.isCommerce) {
    graph.push(buildProductSchema(row, tableDef, entityName, description, brand));
  }

  const geo = buildGeoBlock({
    entityName,
    brand,
    description: rawDescription,
    isCommerceProduct: tableDef.isCommerce,
    price,
  });

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@graph': graph,
    geo,
  };

  return { title, description, keywords, structuredData };
}

/**
 * generateSeo — the single template entry point. Given either a page or a
 * custom row (plus its brand context), returns everything needed to
 * populate a seo_settings record: title, description, keywords, and
 * structured_data (JSON-LD graph + geo summary/faq).
 *
 * `siteUrl` should be the fully-qualified public site origin (e.g.
 * "https://kekalliving.com"), used to build absolute URLs inside
 * structured_data (Organization.url, BreadcrumbList item URLs, etc).
 */
export function generateSeo(entity: SeoEntityInput, siteUrl: string): GeneratedSeo {
  if (entity.kind === 'page') {
    return generateForPage(entity.page, entity.brand, entity.navDepth, entity.breadcrumbTrail, siteUrl);
  }
  return generateForRow(entity.row, entity.tableDef, entity.brand, siteUrl);
}
