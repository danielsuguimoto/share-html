import { Hono } from "hono";
import type { Env } from "./env";
import {
  checkPassword,
  clearSessionCookie,
  createSessionCookie,
  hasSession,
} from "./auth";
import {
  MAX_HTML_BYTES,
  StoreError,
  createPage,
  createPageAutoSlug,
  deletePage,
  isReserved,
  listPages,
  normalizeSlug,
} from "./store";
import { editorPage, loginPage, mcpInfoPage, pagesListPage } from "./ui";

export const admin = new Hono<{ Bindings: Env }>();

admin.use("*", async (c, next) => {
  await next();
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
});

admin.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/admin/login") return next();
  if (await hasSession(c.req.raw, c.env)) return next();
  return c.redirect("/admin/login");
});

admin.get("/login", (c) => c.html(loginPage()));

admin.post("/login", async (c) => {
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const password = typeof body["password"] === "string" ? body["password"] : "";
  if (!(await checkPassword(c.env, password))) {
    return c.html(loginPage("Wrong password."), 401);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin",
      "Set-Cookie": await createSessionCookie(c.env),
    },
  });
});

admin.post("/logout", async (c) => {
  return new Response(null, {
    status: 302,
    headers: { Location: "/admin/login", "Set-Cookie": clearSessionCookie() },
  });
});

admin.get("/", async (c) => {
  const pages = await listPages(c.env.PAGES_BUCKET);
  const origin = new URL(c.req.url).origin;
  const created = c.req.query("created");
  const error = c.req.query("error");
  const flash = error
    ? { kind: "err" as const, text: error }
    : created
      ? { kind: "ok" as const, text: `Published /${created}` }
      : undefined;
  return c.html(pagesListPage(origin, pages, flash));
});

admin.get("/new", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.html(editorPage(origin, c.req.query("error")));
});

admin.get("/mcp", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.html(mcpInfoPage(origin));
});

admin.post("/pages", async (c) => {
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const html = typeof body["html"] === "string" ? body["html"] : "";
  const slugInput = typeof body["slug"] === "string" ? body["slug"] : "";

  const fail = (msg: string) =>
    c.redirect(`/admin/new?error=${encodeURIComponent(msg)}`);

  if (!html.trim()) return fail("HTML is empty.");
  if (new TextEncoder().encode(html).length > MAX_HTML_BYTES) {
    return fail(`HTML exceeds the ${MAX_HTML_BYTES / 1_000_000} MB limit.`);
  }

  if (!slugInput) {
    try {
      const slug = await createPageAutoSlug(c.env.PAGES_BUCKET, html);
      return c.redirect(`/admin?created=${encodeURIComponent(slug)}`);
    } catch {
      return fail("Could not allocate a random slug — pick one manually.");
    }
  }

  const slug = normalizeSlug(slugInput);
  if (!slug) return fail(`"${slugInput}" is not a usable slug.`);
  if (isReserved(slug)) return fail(`"${slug}" is a reserved path.`);

  try {
    await createPage(c.env.PAGES_BUCKET, slug, html);
  } catch (e) {
    if (e instanceof StoreError && e.code === "exists") {
      return fail(`/${slug} already exists — pick another slug or update it via MCP.`);
    }
    throw e;
  }
  return c.redirect(`/admin?created=${encodeURIComponent(slug)}`);
});

admin.post("/pages/:slug/delete", async (c) => {
  await deletePage(c.env.PAGES_BUCKET, c.req.param("slug"));
  return c.redirect("/admin");
});
