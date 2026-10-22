# Share HTML (self-hosted)

Publish small HTML pages and serve them publicly at `https://<domain>/<slug>`.
Single-user admin dashboard, plus an OAuth-secured MCP server for scripted CRUD.

Stack: Cloudflare Workers (compute) + R2 (HTML storage) + KV (OAuth state).

## Routes

| Path | Access | Purpose |
|---|---|---|
| `/<slug>` | public | Serve a published page (`text/html`) |
| `/admin` | password session | Dashboard: list, create (paste or upload), delete |
| `/authorize`, `/token`, `/register` | OAuth 2.1 | Provider endpoints (consent always explicit: approve button when logged in, admin password otherwise) |
| `/mcp` | OAuth bearer | MCP server: `list_pages`, `get_page`, `create_page`, `update_page`, `delete_page` |

## Deploy

```sh
npm install

# 1. Storage
npx wrangler r2 bucket create share-html-pages
npx wrangler kv namespace create OAUTH_KV
#    → paste the returned id into wrangler.jsonc (id + preview_id)

# 2. Secrets
npx wrangler secret put ADMIN_PASSWORD   # admin UI + OAuth approval
npx wrangler secret put SESSION_SECRET   # signs admin session cookies (long random string)

# 3. Ship
npm run deploy
# then attach your custom domain in the Cloudflare dashboard
```

## Local dev

```sh
cp .dev.vars.example .dev.vars   # fill in values
npm run dev                      # http://localhost:8788 (local R2/KV simulation)
```

## MCP client config

Any client that supports remote MCP over Streamable HTTP — point it at the
endpoint and it will walk the OAuth flow (approval = your admin password).

```json
{
  "mcpServers": {
    "share-html": {
      "type": "http",
      "url": "https://<domain>/mcp"
    }
  }
}
```

## Conventions

- R2 keys are `pages/<slug>`; `created` and `title` ride in object custom metadata.
- Slugs: `[a-z0-9-]`, ≤63 chars, single path segment (dots and slashes can never
  appear, so system paths can't be shadowed). `admin`, `api`, `mcp`,
  `authorize`, `token`, `register`, `login`, `logout`, `oauth` are reserved.
- OAuth approval never auto-redirects: logged-in admins see an Approve button;
  everyone else must enter the admin password (defeats CSRF to `/authorize`).
- 25 MB max per page (`MAX_HTML_BYTES` in `src/store.ts`).
- Admin sessions are stateless HMAC-signed cookies (14 days).
- `create_page` refuses to overwrite; `update_page` replaces content and keeps
  the original `created` timestamp.
