/**
 * registryUpdater.ts
 *
 * Produces the new contents of the frontend's
 * src/shared/componentLibrary/registry.ts with a new component appended,
 * given the current file content. Kept as pure string manipulation (no
 * GitHub calls here) so it's easy to unit test in isolation.
 */

export interface NewComponentEntry {
  componentKey: string;
  label: string;
  /** e.g. "Header/Header" -> resolves to './Header/Header' relative import */
  importPath: string;
}

const IMPORT_MARKER = "// __PUBLISH_IMPORTS__";
const ENTRY_MARKER = "// __PUBLISH_ENTRIES__";

/**
 * Appends a new import + registry entry to an existing registry.ts source.
 *
 * Preferred shape (F3 should include these two marker comments so this
 * function has a stable insertion point):
 *
 *   import { Header } from './Header/Header';
 *   // __PUBLISH_IMPORTS__
 *
 *   export const componentRegistry = {
 *     header: { component: Header, label: 'Header', previewProps: {...} },
 *     // __PUBLISH_ENTRIES__
 *   };
 *
 * If the markers aren't present (e.g. F3 shipped without them), falls back
 * to inserting the import after the last existing `import` line and the
 * entry just before the final `};` in the file, so publishing still works.
 */
export function appendComponentToRegistry(currentSource: string, entry: NewComponentEntry): string {
  const importLine = `import { ${entry.componentKey} } from './${entry.importPath}';`;
  const keyLiteral = `'${entry.componentKey}'`;
  const entryLine = `  ${keyLiteral}: { component: ${entry.componentKey}, label: ${JSON.stringify(
    entry.label
  )}, previewProps: {} },`;

  let updated = currentSource;

  if (updated.includes(IMPORT_MARKER)) {
    updated = updated.replace(IMPORT_MARKER, `${importLine}\n${IMPORT_MARKER}`);
  } else {
    const lines = updated.split("\n");
    let lastImportIdx = -1;
    lines.forEach((line, i) => {
      if (line.trim().startsWith("import ")) lastImportIdx = i;
    });
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, importLine);
    } else {
      lines.unshift(importLine);
    }
    updated = lines.join("\n");
  }

  if (updated.includes(ENTRY_MARKER)) {
    updated = updated.replace(ENTRY_MARKER, `${entryLine}\n${ENTRY_MARKER}`);
  } else {
    const closeIdx = updated.lastIndexOf("};");
    if (closeIdx === -1) {
      throw new Error("Could not locate componentRegistry closing brace in registry.ts");
    }
    updated = `${updated.slice(0, closeIdx)}${entryLine}\n${updated.slice(closeIdx)}`;
  }

  return updated;
}
