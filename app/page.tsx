import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ERROR_MESSAGES } from "@/lib/ui";

export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  const e = env();
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted">Log in with WeChat (QR code) or Alipay, then buy a 0.01 CNY test item.</p>
      {error && <p className="alert error">{ERROR_MESSAGES[error] ?? "Something went wrong."}</p>}
      <div className="card stack">
        <div className="row">
          {/* Plain links: the server sets the state cookie, then 302s to the provider. */}
          <a className="btn wechat" href="/api/auth/wechat/login">
            Login with WeChat
          </a>
          <a className="btn alipay" href="/api/auth/alipay/login">
            Login with Alipay
          </a>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          WeChat: <strong>{e.wechatMode}</strong> · Alipay: <strong>{e.alipayMode}</strong>
        </p>
      </div>
    </>
  );
}
