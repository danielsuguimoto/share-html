import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Env } from "./env";
import {
  MAX_HTML_BYTES,
  StoreError,
  createPage,
  createPageAutoSlug,
  deletePage,
  getPage,
  isReserved,
  listPages,
  normalizeSlug,
  pageExists,
  updatePage,
} from "./store";

const slugField = z
  .string()
  .max(63)
  .describe("Page slug: lowercase letters, numbers, hyphens (e.g. 'my-deck')");
const htmlField = z.string().min(1).describe("Full HTML document to publish");

const pageSchema = z.object({
  slug: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  size: z.number(),
  created: z.string(),
});

type ToolText = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (data: unknown): ToolText & { structuredContent: unknown } => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});
const err = (message: string): ToolText => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

function buildServer(env: Env, origin: string): McpServer {
  const server = new McpServer({ name: "share-html", version: "1.0.0" });
  const bucket = env.PAGES_BUCKET;
  const url = (slug: string) => `${origin}/${slug}`;

  const checkHtml = (html: string): string | null => {
    if (new TextEncoder().encode(html).length > MAX_HTML_BYTES) {
      return `HTML exceeds the ${MAX_HTML_BYTES / 1_000_000} MB limit.`;
    }
    return null;
  };
  const resolveSlug = (input: string): { slug: string } | { error: string } => {
    const slug = normalizeSlug(input);
    if (!slug) return { error: `"${input}" is not a usable slug.` };
    if (isReserved(slug)) return { error: `"${slug}" is a reserved path.` };
    return { slug };
  };

  server.registerTool(
    "list_pages",
    {
      title: "List pages",
      description: "List all published HTML pages with their public URLs",
      outputSchema: z.object({ pages: z.array(pageSchema) }),
    },
    async () => {
      const pages = (await listPages(bucket)).map((p) => ({
        ...p,
        url: url(p.slug),
      }));
      return ok({ pages });
    },
  );

  server.registerTool(
    "get_page",
    {
      title: "Get page",
      description: "Read the published HTML of a page by slug",
      inputSchema: z.object({ slug: slugField }),
      outputSchema: z.object({ slug: z.string(), url: z.string(), html: z.string() }),
    },
    async ({ slug }) => {
      const page = await getPage(bucket, slug);
      if (!page) return err(`Page "${slug}" does not exist`);
      return ok({ slug, url: url(slug), html: page.html });
    },
  );

  server.registerTool(
    "create_page",
    {
      title: "Create page",
      description:
        "Publish a new HTML page at /<slug>. Fails if the slug is taken; use update_page to replace content.",
      inputSchema: z.object({
        html: htmlField,
        slug: slugField.optional().describe("Omit for a random slug"),
      }),
      outputSchema: z.object({ slug: z.string(), url: z.string() }),
    },
    async ({ html, slug: input }) => {
      const bad = checkHtml(html);
      if (bad) return err(bad);
      if (!input) {
        const slug = await createPageAutoSlug(bucket, html);
        return ok({ slug, url: url(slug) });
      }
      const resolved = resolveSlug(input);
      if ("error" in resolved) return err(resolved.error);
      try {
        await createPage(bucket, resolved.slug, html);
      } catch (e) {
        if (e instanceof StoreError) return err(e.message);
        throw e;
      }
      return ok({ slug: resolved.slug, url: url(resolved.slug) });
    },
  );

  server.registerTool(
    "update_page",
    {
      title: "Update page",
      description: "Replace the HTML of an existing page",
      inputSchema: z.object({ slug: slugField, html: htmlField }),
      outputSchema: z.object({ slug: z.string(), url: z.string() }),
    },
    async ({ slug, html }) => {
      const bad = checkHtml(html);
      if (bad) return err(bad);
      try {
        await updatePage(bucket, slug, html);
      } catch (e) {
        if (e instanceof StoreError) return err(e.message);
        throw e;
      }
      return ok({ slug, url: url(slug) });
    },
  );

  server.registerTool(
    "delete_page",
    {
      title: "Delete page",
      description: "Remove a published page permanently",
      inputSchema: z.object({ slug: slugField }),
      outputSchema: z.object({ slug: z.string(), deleted: z.boolean() }),
    },
    async ({ slug }) => {
      if (!(await pageExists(bucket, slug))) {
        return err(`Page "${slug}" does not exist`);
      }
      await deletePage(bucket, slug);
      return ok({ slug, deleted: true });
    },
  );

  return server;
}

export function handleMcp(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const origin = new URL(request.url).origin;
  const handler = createMcpHandler(() => buildServer(env, origin), {
    route: "/mcp",
  });
  return handler(request, env, ctx);
}
