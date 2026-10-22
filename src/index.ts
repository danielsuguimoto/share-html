import OAuthProvider, { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { admin } from "./admin";
import { checkPassword, hasSession } from "./auth";
import type { Env } from "./env";
import { handleMcp } from "./mcp";
import { getPage } from "./store";
import { authorizePage } from "./ui";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.redirect("/admin"));

app.route("/admin", admin);

async function finishAuthorization(
  oauth: OAuthHelpers,
  authRequest: AuthRequest,
): Promise<Response> {
  const { redirectTo } = await oauth.completeAuthorization({
    request: authRequest,
    userId: "admin",
    metadata: {},
    scope: authRequest.scope,
    props: {},
  });
  return Response.redirect(redirectTo, 302);
}

async function authorize(c: {
  req: { raw: Request };
  env: Env;
}): Promise<Response> {
  const oauth = c.env.OAUTH_PROVIDER;
  let authRequest: AuthRequest;
  try {
    authRequest = await oauth.parseAuthRequest(c.req.raw);
  } catch (e) {
    if (e instanceof AuthorizationError && e.redirectTo) {
      return Response.redirect(e.redirectTo, 302);
    }
    return new Response("Invalid authorization request", { status: 400 });
  }

  const loggedIn = await hasSession(c.req.raw, c.env);
  const consent = await oauth.describeConsent(authRequest);
  const renderForm = (error?: string) =>
    new Response(
      authorizePage({
        clientName: consent.clientName,
        scopes: consent.scope,
        needsPassword: !loggedIn,
        error,
      }),
      {
        status: error ? 401 : 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Frame-Options": "DENY",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );

  if (c.req.raw.method === "GET") return renderForm();
  if (!loggedIn) {
    const body = await c.req.raw.formData().catch(() => new FormData());
    const password = body.get("password");
    if (typeof password !== "string" || !(await checkPassword(c.env, password))) {
      return renderForm("Wrong password.");
    }
  }
  return finishAuthorization(oauth, authRequest);
}

app.get("/authorize", authorize);
app.post("/authorize", authorize);

app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const page = await getPage(c.env.PAGES_BUCKET, slug);
  if (!page) return c.text("Not found", 404);
  return c.html(page.html);
});

app.notFound((c) => c.text("Not found", 404));

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = new URL(request.url).origin;
    return new OAuthProvider<Env>({
      apiRoute: "/mcp",
      apiHandler: {
        fetch: (req, _env, c) => handleMcp(req, env, c as ExecutionContext),
      },
      defaultHandler: {
        fetch: (req, e, c) => app.fetch(req, e, c),
      },
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      clientRegistrationEndpoint: "/register",
      scopesSupported: ["pages:read", "pages:write"],
      resourceMetadata: {
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        resource_name: "Share HTML",
      },
    }).fetch(request, env, ctx);
  },
};
