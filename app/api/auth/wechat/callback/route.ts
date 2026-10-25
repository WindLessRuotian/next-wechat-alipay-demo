import { finishLogin } from "@/lib/auth/login-flow";
import { wechatExchangeCode } from "@/lib/wechat/oauth";

/** WeChat redirects here with ?code=CODE&state=STATE (no redirect at all if the user declines). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return finishLogin("wechat", { code: q.get("code"), state: q.get("state") }, wechatExchangeCode);
}
