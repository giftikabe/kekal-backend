// src/db/schema/index.ts
//
// Top-level schema barrel. This is what src/db/client.ts imports (as
// `import * as schema from "./schema"`) when constructing the Drizzle
// client, and what any module can import from as `from "../../db/schema"`
// instead of reaching into `./schema/system/...` directly.

export * from "./schema/system";

// Convenience combined object, useful if you ever pass `{ schema }` into
// drizzle(client, { schema }) for relational query support.
import * as system from "./schema/system";

export const schema = {
  ...system,
};
