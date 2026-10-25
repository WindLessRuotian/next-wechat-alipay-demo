import "server-only";
import { cookies } from "next/headers";
import type { Provider } from "@/lib/db/schema";
import { env, isSecureCookie } from "@/lib/env";
import { hmacSha256, randomToken, safeEqual } from "@/lib/crypto";

/**
 * OAuth `state` (CSRF protection, RFC 6749 §10.12).
 * A fresh random state is placed in the authorize URL AND in a short-lived,
 * httpOnly, HMAC-signed cookie scoped to /api/auth. The callback accepts the
 * request only if the query `state` equals the cookie's state; the cookie is
 * deleted on first use, so a state can never be replayed.
 * SameSite=Lax is required: the callback is a cross-site top-level GET.
 */

const TTL_SECONDS = 10 * 60;
const cookieName = (p: Provider) => `oauth_state_${p}`;

interface StatePayload {
  s: string; // state
  l: boolean; // link intent (attach this provider to the signed-in user)
  e: number; // expiry (ms)
}

const sign = (body: string) => hmacSha256(env().SESSION_SECRET, `oauth-state:${body}`);

export async function issueState(provider: Provider, link: boolean): Promise<string> {
  const payload: StatePayload = { s: randomToken(24), l: link, e: Date.now() + TTL_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  (await cookies()).set(cookieName(provider), `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: TTL_SECONDS,
  });
  return payload.s;
}

export type StateCheck = { ok: true; link: boolean } | { ok: false; reason: "missing_cookie" | "tampered" | "expired" | "mismatch" };

export async function consumeState(provider: Provider, stateFromQuery: string | null): Promise<StateCheck> {
  const jar = await cookies();
  const raw = jar.get(cookieName(provider))?.value;
  jar.delete({ name: cookieName(provider), path: "/api/auth" });
  if (!raw) return { ok: false, reason: "missing_cookie" };
  const [body, mac] = raw.split(".");
  if (!body || !mac || !safeEqual(mac, sign(body))) return { ok: false, reason: "tampered" };
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
  if (Date.now() > payload.e) return { ok: false, reason: "expired" };
  if (!stateFromQuery || !safeEqual(stateFromQuery, payload.s)) return { ok: false, reason: "mismatch" };
  return { ok: true, link: payload.l };
}
