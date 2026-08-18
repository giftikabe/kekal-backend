import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { createDb } from "../../db/client";
import { pages } from "../../db/schema/system";
import { commitFiles, getFileContent } from "./githubService";
import { appendComponentToRegistry } from "./registryUpdater";
import type { AppEnv } from "../../types/env";

const publishRouter = new Hono<AppEnv>();
publishRouter.use("*", requireAuth);

interface PublishComponentBody {
  componentKey: string; label: string; category: string; tsxCode: string; cssCode: string; isNew: boolean;
}

publishRouter.post("/component", requireRole(["super_admin", "editor"]), async (c) => {
  let body: PublishComponentBody;
  try {
    body = await c.req.json<PublishComponentBody>();
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "INVALID_BODY" } }, 400);
  }

  if (!body?.componentKey || !body?.tsxCode || !body?.cssCode || !body?.label) {
    return c.json({ error: { message: "componentKey, label, tsxCode and cssCode are required", code: "INVALID_BODY" } }, 400);
  }

  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(body.componentKey)) {
    return c.json({ error: { message: "componentKey must be alphanumeric and start with a letter", code: "INVALID_COMPONENT_KEY" } }, 400);
  }

  const repo = c.env.FRONTEND_REPO;
  const branch = c.env.FRONTEND_BRANCH || "main";
  const token = c.env.GITHUB_TOKEN;

  const basePath = `src/shared/componentLibrary/${body.componentKey}`;
  const filesToCommit = [
    { path: `${basePath}/${body.componentKey}.tsx`, content: body.tsxCode },
    { path: `${basePath}/${body.componentKey}.module.css`, content: body.cssCode },
  ];

  try {
    if (body.isNew) {
      const registryPath = "src/shared/componentLibrary/registry.ts";
      const { content: currentRegistry } = await getFileContent(repo, branch, registryPath, token);
      const updatedRegistry = appendComponentToRegistry(currentRegistry, {
        componentKey: body.componentKey, label: body.label, importPath: `${body.componentKey}/${body.componentKey}`,
      });
      filesToCommit.push({ path: registryPath, content: updatedRegistry });
    }

    const result = await commitFiles(repo, branch, filesToCommit,
      `Publish component: ${body.componentKey}${body.isNew ? " (new)" : " (update)"}`, token);

    return c.json({ data: { componentKey: body.componentKey, isNew: body.isNew, commitShas: result.commitShas, commitUrls: result.commitUrls } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown publish error";
    return c.json({ error: { message, code: "PUBLISH_FAILED" } }, 502);
  }
});

publishRouter.post("/page/:pageId", requireRole(["super_admin", "editor"]), async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const pageId = c.req.param("pageId");

  const [updated] = await db.update(pages).set({ status: "published", updatedAt: new Date() }).where(eq(pages.id, pageId)).returning();
  if (!updated) return c.json({ error: { message: "Page not found", code: "NOT_FOUND" } }, 404);
  return c.json({ data: updated });
});

export { publishRouter };