import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { Provider } from "@/lib/db/schema";
import { issueMockCode, mockAvatar } from "./oauth";

export const isMockProvider = (p: string): p is Provider =>
  (p === "wechat" ? env().wechatMode : p === "alipay" ? env().alipayMode : null) === "mock";

/** Only our own callback route is a registered redirect_uri — as with the real providers. */
export function safeRedirectUri(raw: string | null | undefined, provider: Provider): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.origin === new URL(env().APP_URL).origin && u.pathname === `/api/auth/${provider}/callback` ? u : null;
  } catch {
    return null;
  }
}

export const PERSONAS: Record<Provider, { name: string; hue: number }[]> = {
  wechat: [
    { name: "微信测试用户", hue: 140 },
    { name: "Mock WeChat Bob", hue: 20 },
  ],
  alipay: [
    { name: "支付宝沙箱买家", hue: 215 },
    { name: "Mock Alipay Carol", hue: 280 },
  ],
};

/** Build the provider → app redirect, exactly in each provider's callback format. */
export async function mockAuthorizeRedirect(provider: Provider, target: URL, state: string, decision: "allow" | "deny", nickname: string, hue: number): Promise<URL> {
  const u = new URL(target);
  if (decision === "allow") {
    // A stable fake user id per nickname, so logging in twice finds the same local user.
    const stable = crypto.createHash("sha256").update(`${provider}:${nickname}`).digest("hex");
    const code = await issueMockCode(provider, {
      providerUserId: provider === "wechat" ? `oMOCK${stable.slice(0, 23)}` : `0${stable.slice(0, 15)}`,
      unionId: provider === "wechat" ? `uMOCK${stable.slice(23, 50)}` : undefined,
      nickname,
      avatarUrl: mockAvatar(nickname, hue),
    });
    if (provider === "wechat") u.searchParams.set("code", code);
    else {
      u.searchParams.set("app_id", "9021000000000000");
      u.searchParams.set("source", "alipay_wallet");
      u.searchParams.set("scope", "auth_user");
      u.searchParams.set("auth_code", code);
    }
  }
  // Denial: real WeChat simply doesn't redirect; we return without a code so the demo can continue.
  u.searchParams.set("state", state);
  return u;
}
