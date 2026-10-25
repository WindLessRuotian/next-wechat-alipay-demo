import "server-only";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { redact } from "@/lib/crypto";
import { consumeMockCode } from "@/lib/mock/oauth";
import type { ProviderProfile } from "@/lib/auth/users";

/**
 * WeChat Open Platform — website application QR-code login (scope snsapi_login).
 *   1. https://open.weixin.qq.com/connect/qrconnect?appid&redirect_uri&response_type=code&scope=snsapi_login&state#wechat_redirect
 *   2. GET https://api.weixin.qq.com/sns/oauth2/access_token?appid&secret&code&grant_type=authorization_code
 *   3. GET https://api.weixin.qq.com/sns/userinfo?access_token&openid
 * code: valid 10 minutes, single use.
 * https://developers.weixin.qq.com/doc/oplatform/developers/dev/auth/web.html
 */

export function wechatAuthorizeUrl(redirectUri: string, state: string): string {
  const e = env();
  if (e.wechatMode === "mock") {
    const u = new URL("/mock/oauth/wechat", e.APP_URL);
    u.searchParams.set("appid", "wxMOCK000000000000");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "snsapi_login");
    u.searchParams.set("state", state);
    return u.toString();
  }
  const q = new URLSearchParams({
    appid: e.WECHAT_APP_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_login",
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${q.toString()}#wechat_redirect`;
}

interface WxError {
  errcode?: number;
  errmsg?: string;
}

async function wxGet<T>(url: string, what: string): Promise<T & WxError> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const data = (await res.json()) as T & WxError;
  if (!res.ok || (data.errcode && data.errcode !== 0)) {
    log.warn("wechat.oauth_error", { step: what, status: res.status, errcode: data.errcode, errmsg: data.errmsg });
    throw new Error(`wechat ${what} failed: ${data.errcode ?? res.status}`);
  }
  return data;
}

export async function wechatExchangeCode(code: string): Promise<ProviderProfile> {
  const e = env();
  if (e.wechatMode === "mock") {
    const p = await consumeMockCode("wechat", code);
    if (!p) throw new Error("wechat mock: invalid or used code (40029 invalid code)");
    return { provider: "wechat", ...p };
  }
  const token = await wxGet<{ access_token: string; openid: string; unionid?: string; scope: string }>(
    `https://api.weixin.qq.com/sns/oauth2/access_token?${new URLSearchParams({
      appid: e.WECHAT_APP_ID ?? "",
      secret: e.WECHAT_APP_SECRET ?? "",
      code,
      grant_type: "authorization_code",
    }).toString()}`,
    "access_token",
  );
  log.info("wechat.oauth_token_ok", { openid: redact(token.openid), scope: token.scope });
  const info = await wxGet<{ openid: string; nickname: string; headimgurl: string; unionid?: string }>(
    `https://api.weixin.qq.com/sns/userinfo?${new URLSearchParams({ access_token: token.access_token, openid: token.openid }).toString()}`,
    "userinfo",
  );
  return {
    provider: "wechat",
    providerUserId: token.openid,
    unionId: info.unionid ?? token.unionid,
    nickname: info.nickname,
    avatarUrl: info.headimgurl || undefined,
  };
}
