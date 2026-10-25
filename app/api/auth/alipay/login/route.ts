import { alipay } from "@/lib/alipay/client";
import { startLogin } from "@/lib/auth/login-flow";

export async function GET(req: Request) {
  const client = await alipay();
  return startLogin(req, "alipay", (redirectUri, state) => client.authorizeUrl(redirectUri, state));
}
