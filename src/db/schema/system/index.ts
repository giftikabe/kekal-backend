// src/db/schema/system/index.ts
//
// Barrel export for every system table and enum.
// Import from 'src/db/schema/system' (or the alias '../../db/schema/system'
// from a module) rather than reaching into individual files directly.
//
// NOTE: cross-schema FK references inside the individual schema files
// (e.g. nav.ts -> pages.ts) use sibling relative imports, NOT this barrel,
// to avoid circular-dependency issues. That is intentional; do not change it.

export * from './admins';
export * from './brand';
export * from './commerceSettings';
export * from './componentInstances';
export * from './customFieldDefs';
export * from './customRows';
export * from './customTableDefs';
export * from './nav';
export * from './orderItems';
export * from './orders';
export * from './pageSections';
export * from './pages';
export * from './payments';
export * from './seoSettings';
export * from './shipments';