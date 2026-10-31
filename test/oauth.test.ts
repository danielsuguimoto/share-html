import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthProvider, type OAuthProviderOptions } from "@cloudflare/workers-oauth-provider";
import { oauthOptions } from "../src/index";
import { fetchOAuth, REFRESH_TOKEN_TTL_SECONDS } from "../src/oauth";
import type { Env } from "../src/env";

vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {},
  RpcTarget: class {},
  WorkflowEntrypoint: class {},
  exports: {},
}));
vi.mock("cloudflare:email", () => ({ EmailMessage: class {} }));

const ORIGIN = "https://share-html.example";
const REDIRECT = "https://client.example/callback";
const VERIFIER = "a".repeat(43);
const DAY_MS = 24 * 60 * 60 * 1000;
type Method = "client_secret_basic" | "client_secret_post" | "none";
type Client = { client_id: string; client_secret?: string };
type Tokens = {
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
};

function formEncode(value: string): string {
  return new URLSearchParams({ v: value }).toString().slice(2);
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function makeEnv(): Env {
  const values = new Map<string, { value: string; expires?: number }>();
  const kv = {
    async get(key: string, options?: string | { type?: string }) {
      const entry = values.get(key);
      if (!entry || (entry.expires !== undefined && entry.expires <= Date.now() / 1000)) {
        return null;
      }
      const type = typeof options === "string" ? options : options?.type;
      return type === "json" ? JSON.parse(entry.value) : entry.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      values.set(key, {
        value,
        expires: options?.expirationTtl === undefined
          ? undefined
          : Date.now() / 1000 + options.expirationTtl,
      });
    },
    async delete(key: string) {
      values.delete(key);
    },
    async list({ prefix }: { prefix?: string }) {
      return {
        keys: [...values.keys()]
          .filter((name) => name.startsWith(prefix ?? ""))
          .map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
  const env = {
    PAGES_BUCKET: {} as R2Bucket,
    OAUTH_KV: kv as unknown as KVNamespace,
    OAUTH_PROVIDER: {} as Env["OAUTH_PROVIDER"],
    ADMIN_PASSWORD: "test-admin-password",
    SESSION_SECRET: "test-session-secret",
  };
  Reflect.deleteProperty(env, "OAUTH_PROVIDER");
  return env as Env;
}

function makeCtx(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
}

describe("OAuth resilience", () => {
  let env: Env;
  let ctx: ExecutionContext;
  let options: OAuthProviderOptions<Env>;
  let warnings: ReturnType<typeof vi.spyOn>;

  async function request(path: string | URL, init?: RequestInit, raw = false) {
    const req = new Request(new URL(path, ORIGIN), init);
    return raw
      ? new OAuthProvider(options).fetch(req, env, ctx)
      : fetchOAuth(req, env, ctx, options);
  }

  async function register(method?: Method): Promise<Client> {
    const response = await request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Test MCP client",
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: method,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(response.status).toBe(201);
    const client = await response.json() as Client & { token_endpoint_auth_method: string };
    expect(client.token_endpoint_auth_method).toBe(method ?? "client_secret_basic");
    if (method === "none") expect(client.client_secret).toBeUndefined();
    else expect(client.client_secret).toBeTruthy();
    return client;
  }

  function credentials(client: Client, method: Method, fields: Record<string, string>) {
    const body = new URLSearchParams(fields);
    const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
    if (method === "client_secret_basic") {
      headers.set(
        "Authorization",
        `Basic ${btoa(`${formEncode(client.client_id)}:${formEncode(client.client_secret ?? "")}`)}`,
      );
    } else {
      body.set("client_id", client.client_id);
      if (method === "client_secret_post" && client.client_secret !== undefined) {
        body.set("client_secret", client.client_secret);
      }
    }
    return { method: "POST", headers, body };
  }

  async function authorizationUrl(client: Client): Promise<URL> {
    const challenge = base64url(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(VERIFIER)),
    );
    const url = new URL("/authorize", ORIGIN);
    url.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: REDIRECT,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "test-state",
    }).toString();
    return url;
  }

  async function authorize(client: Client): Promise<string> {
    const response = await request(await authorizationUrl(client), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: env.ADMIN_PASSWORD }),
    });
    expect(response.status).toBe(302);
    return new URL(response.headers.get("Location")!).searchParams.get("code")!;
  }

  async function exchange(client: Client, method: Method, raw = false): Promise<Tokens> {
    const code = await authorize(client);
    const response = await request("/token", credentials(client, method, {
      grant_type: "authorization_code",
      code,
      code_verifier: VERIFIER,
      redirect_uri: REDIRECT,
    }), raw);
    expect(response.status).toBe(200);
    return response.json() as Promise<Tokens>;
  }

  function refresh(client: Client, method: Method, token: string, raw = false) {
    return request("/token", credentials(client, method, {
      grant_type: "refresh_token",
      refresh_token: token,
    }), raw);
  }

  function cimdClient() {
    const client: Client = { client_id: `https://cimd.example/${crypto.randomUUID()}.json` };
    const upstream: { state: 200 | 503 | 429 | 404 | "network" | "invalid" } = { state: 200 };
    const fetchMetadata = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      expect(input instanceof Request ? input.url : String(input)).toBe(client.client_id);
      if (upstream.state === "network") throw new TypeError("Test metadata network unavailable");
      if (upstream.state === "invalid") return Response.json({ client_id: "wrong-id" });
      return Response.json({
        client_id: client.client_id,
        client_name: "Test CIMD client",
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: "none",
      }, { status: upstream.state, headers: { "Cache-Control": "no-store" } });
    });
    return { client, upstream, fetchMetadata };
  }

  async function expectUnavailable(response: Response) {
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: "temporarily_unavailable" });
  }

  beforeEach(() => {
    warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("Cloudflare", { compatibilityFlags: { global_fetch_strictly_public: true } });
    env = makeEnv();
    ctx = makeCtx();
    options = oauthOptions(ORIGIN);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("advertises refresh grants, interoperable auth methods, and CIMD support", async () => {
    const response = await request("/.well-known/oauth-authorization-server");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
        "private_key_jwt",
      ],
      client_id_metadata_document_supported: true,
    });
  });

  it.each([
    ["client_secret_basic", "client_secret_post"],
    ["client_secret_post", "client_secret_basic"],
  ] as const)("reproduces the strict-method 401 for %s -> %s without normalization", async (registered, presented) => {
    const client = await register(registered);
    const tokens = await exchange(client, registered);
    const response = await refresh(client, presented, tokens.refresh_token, true);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "invalid_client",
      error_description: "Client authentication failed",
    });
  });

  it.each([
    ["client_secret_basic", "client_secret_post"],
    ["client_secret_post", "client_secret_basic"],
    ["client_secret_basic", "client_secret_basic"],
    ["client_secret_post", "client_secret_post"],
  ] as const)("normalizes %s credentials presented as %s", async (registered, presented) => {
    const client = await register(registered);
    const tokens = await exchange(client, presented);
    const response = await refresh(client, presented, tokens.refresh_token);
    expect(response.status).toBe(200);
    const rotated = await response.json() as Tokens;
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);
  });

  it.each([
    ["client_secret_basic", "client_secret_post"],
    ["client_secret_post", "client_secret_basic"],
  ] as const)("still verifies the secret for %s -> %s", async (registered, presented) => {
    const client = await register(registered);
    const tokens = await exchange(client, registered);
    const response = await refresh(
      { ...client, client_secret: "wrong-secret" },
      presented,
      tokens.refresh_token,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "invalid_client" });
    if (presented === "client_secret_basic") {
      expect(response.headers.get("WWW-Authenticate")).toMatch(/^Basic /);
    }
    expect((await refresh(client, presented, tokens.refresh_token)).status).toBe(200);
  });

  it.each(["client_id", "client_secret"])("does not repair repeated %s parameters", async (parameter) => {
    const client = await register("client_secret_basic");
    const tokens = await exchange(client, "client_secret_basic");
    const init = credentials(client, "client_secret_post", {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    });
    init.body.append(parameter, init.body.get(parameter)!);
    const response = await request("/token", init);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_request" });
  });

  it("does not repair Basic and body credentials sent together", async () => {
    const client = await register("client_secret_post");
    const tokens = await exchange(client, "client_secret_post");
    const init = credentials(client, "client_secret_post", {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    });
    init.headers.set(
      "Authorization",
      credentials(client, "client_secret_basic", {}).headers.get("Authorization")!,
    );
    const response = await request("/token", init);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_request" });
  });

  it.each(["client_secret_basic", "client_secret_post"] as const)(
    "never downgrades %s to a public client",
    async (registered) => {
      const client = await register(registered);
      const tokens = await exchange(client, registered);
      const response = await refresh(
        { client_id: client.client_id },
        "none",
        tokens.refresh_token,
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: "invalid_client" });
      expect((await refresh(client, registered, tokens.refresh_token)).status).toBe(200);
    },
  );

  it.each(["client_secret_basic", "client_secret_post"] as const)(
    "never converts a public client to %s",
    async (presented) => {
      const client = await register("none");
      const tokens = await exchange(client, "none");
      const response = await refresh(
        { ...client, client_secret: "unregistered-secret" },
        presented,
        tokens.refresh_token,
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: "invalid_client" });
      expect((await refresh(client, "none", tokens.refresh_token)).status).toBe(200);
    },
  );

  it("keeps active grants alive past the old 30-day absolute expiry, then expires idle grants", async () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
    const client = await register("none");
    let tokens = await exchange(client, "none");
    const start = Date.now();
    const clock = vi.spyOn(Date, "now");
    for (const day of [29, 58]) {
      clock.mockReturnValue(start + day * DAY_MS);
      const response = await refresh(client, "none", tokens.refresh_token);
      expect(response.status).toBe(200);
      tokens = await response.json() as Tokens;
      expect(tokens.expires_in).toBe(3600);
    }
    clock.mockReturnValue(start + 89 * DAY_MS);
    const expired = await refresh(client, "none", tokens.refresh_token);
    expect(expired.status).toBe(400);
    expect(await expired.json()).toMatchObject({ error: "invalid_grant" });
  });

  it.each([false, true])(
    "reproduces the old absolute expiry and migrates live grants (rolling: %s)",
    async (rolling) => {
      const client = await register("none");
      const tokens = await exchange(client, "none", true);
      const start = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(start + 20 * DAY_MS);
      const first = await refresh(client, "none", tokens.refresh_token, !rolling);
      expect(first.status).toBe(200);
      const next = await first.json() as Tokens;
      clock.mockReturnValue(start + 31 * DAY_MS);
      const second = await refresh(client, "none", next.refresh_token, !rolling);
      expect(second.status).toBe(rolling ? 200 : 400);
      if (!rolling) {
        expect(await second.json()).toMatchObject({ error: "invalid_grant" });
      }
    },
  );

  it("reproduces the provider's CIMD invalid_client response without the outage mapping", async () => {
    const { client, upstream } = cimdClient();
    const tokens = await exchange(client, "none");
    upstream.state = 503;
    const response = await refresh(client, "none", tokens.refresh_token, true);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "invalid_client",
      error_description: "Client not found",
    });
  });

  it.each([503, 429, "network", 404, "invalid"] as const)(
    "maps CIMD resolution failure (%s) to retryable 503 without consuming refresh credentials",
    async (state) => {
      const { client, upstream } = cimdClient();
      const tokens = await exchange(client, "none");
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3601 * 1000);
      const put = vi.spyOn(env.OAUTH_KV, "put");
      const remove = vi.spyOn(env.OAUTH_KV, "delete");
      upstream.state = state;
      await expectUnavailable(await refresh(client, "none", tokens.refresh_token));
      expect(put).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      upstream.state = 200;
      const recovered = await refresh(client, "none", tokens.refresh_token);
      expect(recovered.status).toBe(200);
      const rotated = await recovered.json() as Tokens;
      expect(rotated.refresh_token).not.toBe(tokens.refresh_token);
    },
  );

  it("retries the same authorization code after a CIMD outage without consuming it", async () => {
    const { client, upstream } = cimdClient();
    const code = await authorize(client);
    const fields = {
      grant_type: "authorization_code",
      code,
      code_verifier: VERIFIER,
      redirect_uri: REDIRECT,
    };
    upstream.state = "network";
    await expectUnavailable(await request("/token", credentials(client, "none", fields)));
    upstream.state = 200;
    expect((await request("/token", credentials(client, "none", fields))).status).toBe(200);
  });

  it.each(["GET", "POST"])(
    "returns retryable 503 during %s authorization when CIMD is unavailable",
    async (method) => {
      const { client, upstream } = cimdClient();
      const url = await authorizationUrl(client);
      upstream.state = "network";
      const response = method === "GET"
        ? await request(url)
        : await request(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ password: env.ADMIN_PASSWORD }),
        });
      expect(response.headers.get("Location")).toBeNull();
      await expectUnavailable(response);
    },
  );
});
