import { startLogin } from "@/lib/auth/login-flow";
import { wechatAuthorizeUrl } from "@/lib/wechat/oauth";

export async function GET(req: Request) {
  return startLogin(req, "wechat", wechatAuthorizeUrl);
}
