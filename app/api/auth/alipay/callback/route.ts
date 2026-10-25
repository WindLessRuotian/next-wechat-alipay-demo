import { NextResponse } from "next/server";
import { alipay } from "@/lib/alipay/client";
import { finishLogin } from "@/lib/auth/login-flow";
import { env } from "@/lib/env";

/** Alipay redirects here with ?app_id=…&auth_code=…&scope=auth_user&state=… */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const client = await alipay();
  if (q.get("app_id") && q.get("app_id") !== client.config.appId) {
    return NextResponse.redirect(new URL("/?error=invalid_app", env().APP_URL), 302);
  }
  return finishLogin("alipay", { code: q.get("auth_code"), state: q.get("state") }, async (code) => {
    const token = await client.oauthToken(code);
    const info = await client.userInfo(token.accessToken);
    return {
      provider: "alipay",
      providerUserId: token.userKey,
      nickname: info.nickname,
      avatarUrl: info.avatar,
    };
  });
}
