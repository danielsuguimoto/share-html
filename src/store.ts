const PREFIX = "pages/";
export const MAX_HTML_BYTES = 25_000_000;

const RESERVED = new Set([
  "admin",
  "api",
  "mcp",
  "authorize",
  "token",
  "register",
  "login",
  "logout",
  "oauth",
]);

export interface PageInfo {
  slug: string;
  title: string | null;
  size: number;
  created: string;
}

export function isReserved(slug: string): boolean {
  const first = slug.split("/")[0] ?? slug;
  return RESERVED.has(first) || slug.includes("/");
}

export function normalizeSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  return slug;
}

export function randomSlug(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => (b % 36).toString(36)).join("");
}

export function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]{0,200})/i.exec(html.slice(0, 5000));
  return m?.[1]?.trim() || null;
}

export async function listPages(bucket: R2Bucket): Promise<PageInfo[]> {
  const pages: PageInfo[] = [];
  let cursor: string | undefined;
  do {
    const res = await bucket.list({
      prefix: PREFIX,
      limit: 1000,
      cursor,
      include: ["customMetadata"],
    });
    for (const obj of res.objects) {
      const slug = obj.key.slice(PREFIX.length);
      if (!slug) continue;
      pages.push({
        slug,
        title: (obj.customMetadata?.["title"] as string | undefined) ?? null,
        size: obj.size,
        created:
          (obj.customMetadata?.["created"] as string | undefined) ??
          obj.uploaded.toISOString(),
      });
    }
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor);
  pages.sort((a, b) => b.created.localeCompare(a.created));
  return pages;
}

export async function getPage(
  bucket: R2Bucket,
  slug: string,
): Promise<{ html: string; info: PageInfo } | null> {
  const obj = await bucket.get(PREFIX + slug);
  if (!obj) return null;
  return {
    html: await obj.text(),
    info: {
      slug,
      title: (obj.customMetadata?.["title"] as string | undefined) ?? null,
      size: obj.size,
      created:
        (obj.customMetadata?.["created"] as string | undefined) ??
        obj.uploaded.toISOString(),
    },
  };
}

export async function pageExists(
  bucket: R2Bucket,
  slug: string,
): Promise<boolean> {
  return (await bucket.head(PREFIX + slug)) !== null;
}

async function putPage(
  bucket: R2Bucket,
  slug: string,
  html: string,
  created: string,
): Promise<void> {
  const title = extractTitle(html);
  await bucket.put(PREFIX + slug, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
    customMetadata: { created, ...(title ? { title } : {}) },
  });
}

export async function createPage(
  bucket: R2Bucket,
  slug: string,
  html: string,
): Promise<void> {
  if (await pageExists(bucket, slug)) {
    throw new StoreError("exists", `Page "${slug}" already exists`);
  }
  await putPage(bucket, slug, html, new Date().toISOString());
}

export async function createPageAutoSlug(
  bucket: R2Bucket,
  html: string,
  attempts = 5,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const slug = randomSlug();
    try {
      await createPage(bucket, slug, html);
      return slug;
    } catch (e) {
      if (!(e instanceof StoreError) || e.code !== "exists") throw e;
    }
  }
  throw new StoreError("exists", "Could not allocate a random slug");
}

export async function updatePage(
  bucket: R2Bucket,
  slug: string,
  html: string,
): Promise<void> {
  const existing = await bucket.head(PREFIX + slug);
  if (!existing) {
    throw new StoreError("not_found", `Page "${slug}" does not exist`);
  }
  const created =
    (existing.customMetadata?.["created"] as string | undefined) ??
    new Date().toISOString();
  await putPage(bucket, slug, html, created);
}

export async function deletePage(
  bucket: R2Bucket,
  slug: string,
): Promise<void> {
  await bucket.delete(PREFIX + slug);
}

export class StoreError extends Error {
  constructor(
    public code: "exists" | "not_found",
    message: string,
  ) {
    super(message);
  }
}
