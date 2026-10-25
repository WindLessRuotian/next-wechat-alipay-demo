import "server-only";
import { NextResponse } from "next/server";
import type { Provider } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { consumeState, issueState } from "./oauth-state";
import { createSession, getSession } from "./session";
import { LinkError, upsertUserFromProfile, type ProviderProfile } from "./users";

export const callbackUrl = (provider: Provider): string => new URL(`/api/auth/${provider}/callback`, env().APP_URL).toString();

const to = (path: string) => NextResponse.redirect(new URL(path, env().APP_URL), 302);

/** GET /api/auth/<provider>/login[?link=1] */
export async function startLogin(req: Request, provider: Provider, authorizeUrl: (redirectUri: string, state: string) => string | Promise<string>) {
  const wantsLink = new URL(req.url).searchParams.get("link") === "1";
  const link = wantsLink && (await getSession()) !== null;
  const state = await issueState(provider, link);
  return NextResponse.redirect(await authorizeUrl(callbackUrl(provider), state), 302);
}

/** Shared tail of both callbacks: validate state, exchange code server-side, upsert user, set cookie. */
export async function finishLogin(
  provider: Provider,
  params: { code: string | null; state: string | null },
  exchange: (code: string) => Promise<ProviderProfile>,
) {
  const state = await consumeState(provider, params.state);
  if (!state.ok) {
    log.warn("auth.state_rejected", { provider, reason: state.reason });
    return to(`/?error=invalid_state`);
  }
  if (!params.code) return to(`/?error=access_denied`);

  let profile: ProviderProfile;
  try {
    profile = await exchange(params.code);
  } catch (e) {
    log.warn("auth.exchange_failed", { provider, message: (e as Error).message });
    return to(`/?error=exchange_failed`);
  }

  const current = state.link ? await getSession() : null;
  try {
    const user = await upsertUserFromProfile(profile, current?.user.id);
    if (!current) await createSession(user.id, provider);
    log.info("auth.login_ok", { provider, userId: user.id, linked: !!current });
    return to(current ? "/dashboard?linked=1" : "/dashboard");
  } catch (e) {
    if (e instanceof LinkError) return to(`/dashboard?error=${e.code}`);
    throw e;
  }
}
