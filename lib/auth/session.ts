import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import type { Provider, User } from "@/lib/db/schema";
import { env, isSecureCookie } from "@/lib/env";
import { hmacSha256, randomToken } from "@/lib/crypto";

/**
 * Hand-rolled, database-backed sessions.
 * Cookie: opaque 256-bit random token, httpOnly, SameSite=Lax, Secure on https
 * (and the "__Host-" prefix, which forces Secure + Path=/ + no Domain).
 * DB: only HMAC-SHA256(SESSION_SECRET, token) is stored, so a leaked DB
 * cannot be replayed as cookies, and logout really revokes the session.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const sessionCookieName = (): string => (isSecureCookie() ? "__Host-sid" : "sid");
const hashToken = (token: string): string => hmacSha256(env().SESSION_SECRET, `session:${token}`);

export async function createSession(userId: string, provider: Provider): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await (await db()).insert(schema.sessions).values({ idHash: hashToken(token), userId, provider, expiresAt }).run();
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export interface CurrentSession {
  user: User;
  provider: Provider;
}

export async function getSession(): Promise<CurrentSession | null> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;
  const row = await (await db())
    .select({ user: schema.users, provider: schema.sessions.provider })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.idHash, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .get();
  return row ?? null;
}

/** For server components / pages: redirect to the landing page when signed out. */
export async function requireSession(): Promise<CurrentSession> {
  const s = await getSession();
  if (!s) redirect("/?error=signin_required");
  return s;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await (await db()).delete(schema.sessions).where(eq(schema.sessions.idHash, hashToken(token))).run();
  jar.delete({ name: sessionCookieName(), path: "/", secure: isSecureCookie(), httpOnly: true, sameSite: "lax" });
}
