import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession, type CurrentSession } from "@/lib/auth/session";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const jsonError = (status: number, error: string, message?: string) => json({ error, message }, status);

/**
 * CSRF defence for state-changing JSON endpoints (in addition to SameSite=Lax):
 * require the browser-supplied Origin (or Sec-Fetch-Site) to be our own.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return origin === new URL(env().APP_URL).origin || origin === new URL(req.url).origin;
  return req.headers.get("sec-fetch-site") === "same-origin";
}

type Guarded = { ok: true; session: CurrentSession } | { ok: false; response: NextResponse };

export async function guardUserPost(req: Request): Promise<Guarded> {
  if (!isSameOrigin(req)) return { ok: false, response: jsonError(403, "forbidden_origin") };
  const session = await getSession();
  if (!session) return { ok: false, response: jsonError(401, "unauthenticated") };
  return { ok: true, session };
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("x-real-ip") || "127.0.0.1";
}

export const isMobileUA = (req: Request): boolean =>
  /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(req.headers.get("user-agent") ?? "");

/** Public, browser-safe view of an order (no internal fields). */
export function publicOrder(o: import("@/lib/db/schema").Order) {
  return {
    id: o.id,
    outTradeNo: o.outTradeNo,
    provider: o.provider,
    subject: o.subject,
    amountFen: o.amountFen,
    currency: o.currency,
    status: o.status,
    providerTradeNo: o.providerTradeNo,
    codeUrl: o.status === "pending" ? o.codeUrl : null,
    failureReason: o.failureReason,
    expiresAt: o.expiresAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    closedAt: o.closedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}
export type PublicOrder = ReturnType<typeof publicOrder>;
