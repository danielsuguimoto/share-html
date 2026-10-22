import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  PAGES_BUCKET: R2Bucket;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}
