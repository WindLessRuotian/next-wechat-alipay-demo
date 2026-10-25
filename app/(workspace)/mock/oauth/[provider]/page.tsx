import { notFound } from "next/navigation";
import { isMockProvider, PERSONAS, safeRedirectUri } from "@/lib/mock/authorize";

/**
 * MOCK provider consent screen — stands in for open.weixin.qq.com/connect/qrconnect
 * and Alipay's publicAppAuthorize.htm. It returns to the SAME callback route as the
 * real provider, with a single-use code and the original state.
 */
export default async function MockAuthorize({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { provider } = await params;
  if (!isMockProvider(provider)) notFound();
  const q = await searchParams;
  const redirectUri = safeRedirectUri(q.redirect_uri, provider);
  if (!redirectUri) return <p className="alert error">redirect_uri is not registered for this (mock) app.</p>;
  const label = provider === "wechat" ? "WeChat" : "Alipay";
  const action = `/api/mock/oauth/${provider}/authorize`;
  const hidden = (
    <>
      <input type="hidden" name="redirect_uri" value={redirectUri.toString()} />
      <input type="hidden" name="state" value={q.state ?? ""} />
    </>
  );

  return (
    <>
      <h1>Mock {label} authorisation</h1>
      <p className="muted">
        In sandbox/live mode this is the provider&apos;s own page ({provider === "wechat" ? "a QR code on open.weixin.qq.com" : "Alipay's authorisation page"}). Pick a
        fake user to return to the app&apos;s real callback route.
      </p>
      <div className="card stack">
        {PERSONAS[provider].map((p) => (
          <form key={p.name} action={action} method="post" className="row">
            {hidden}
            <input type="hidden" name="nickname" value={p.name} />
            <input type="hidden" name="hue" value={p.hue} />
            <button className={`btn ${provider}`} name="decision" value="allow">
              Authorise as “{p.name}”
            </button>
          </form>
        ))}
        <form action={action} method="post">
          {hidden}
          <button className="btn" name="decision" value="deny">
            Deny
          </button>
        </form>
        <p className="mono muted" style={{ margin: 0 }}>state = {q.state}</p>
      </div>
    </>
  );
}
