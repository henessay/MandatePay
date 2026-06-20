import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Stateless, dependency-free auth: HMAC-signed tokens (nonce + session) carried
 * in an httpOnly cookie. No database — a session is `base64url(json).hmac`, so it
 * survives serverless cold starts and runs fully offline. Swap AUTH_SECRET in prod.
 */
const SECRET = process.env.AUTH_SECRET || "mandatepay-dev-secret-change-me";
export const SESSION_COOKIE = "mp_session";

function hmac(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

function issueToken(payload: Record<string, unknown>, ttlMs: number): string {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${data}.${hmac(data)}`;
}

export function readToken<T = Record<string, unknown>>(token?: string | null): T | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expect = hmac(data);
  const macBuf = Buffer.from(mac);
  const expBuf = Buffer.from(expect);
  if (macBuf.length !== expBuf.length || !timingSafeEqual(macBuf, expBuf)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, "base64url").toString()) as { exp?: number } & T;
    if (typeof body.exp !== "number" || body.exp < Date.now()) return null;
    return body as T;
  } catch {
    return null;
  }
}

export function issueNonce(): string {
  return issueToken({ k: "nonce", n: randomBytes(12).toString("hex") }, 5 * 60 * 1000);
}

export function nonceIsValid(nonce: string): boolean {
  const t = readToken<{ k?: string }>(nonce);
  return !!t && t.k === "nonce";
}

export function issueSession(address: string): string {
  return issueToken({ k: "session", address: address.toLowerCase() }, 7 * 24 * 3600 * 1000);
}

export function readSession(token?: string | null): { address: string } | null {
  const t = readToken<{ k?: string; address?: string }>(token);
  if (!t || t.k !== "session" || typeof t.address !== "string") return null;
  return { address: t.address };
}
