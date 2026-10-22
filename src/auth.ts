import type { Env } from "./env";

export const SESSION_COOKIE = "sh_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

async function hmacKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

let adminDigest: { password: string; digest: Promise<ArrayBuffer> } | undefined;

function envPasswordDigest(env: Env): Promise<ArrayBuffer> {
  if (adminDigest?.password !== env.ADMIN_PASSWORD) {
    adminDigest = {
      password: env.ADMIN_PASSWORD,
      digest: crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(env.ADMIN_PASSWORD),
      ),
    };
  }
  return adminDigest.digest;
}

export async function checkPassword(env: Env, password: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(password)),
    envPasswordDigest(env),
  ]);
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

async function sign(env: Env, payload: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(env),
    new TextEncoder().encode(payload),
  );
  return toHex(sig);
}

export async function createSessionCookie(env: Env): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const sig = await sign(env, String(exp));
  return `${SESSION_COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function hasSession(request: Request, env: Env): Promise<boolean> {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(exp) || !/^[0-9a-f]+$/.test(sig)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  let sigBytes: Uint8Array;
  try {
    sigBytes = fromHex(sig);
  } catch {
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(env),
    sigBytes,
    new TextEncoder().encode(exp),
  );
}
