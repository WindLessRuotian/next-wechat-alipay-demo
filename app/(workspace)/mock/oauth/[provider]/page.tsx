import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MockConsentForm from "@/components/MockConsentForm";
import { ChannelIcon, Hint, PageHeading } from "@/components/ui/primitives";
import { isMockProvider, PERSONAS, safeRedirectUri } from "@/lib/mock/authorize";
import { mockAvatar } from "@/lib/mock/oauth";
import { providerLabel } from "@/lib/ui";

export const metadata: Metadata = { title: "模拟账号授权" };

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
  const label = providerLabel(provider);

  return (
    <>
      <PageHeading title="模拟账号授权" desc="在本地体验官方授权回调的完整路径。" />
      <section className="card auth-card">
        <div className="auth-heading">
          <ChannelIcon provider={provider} size="lg" />
          <h2>{label} Mock 授权</h2>
          <p className="caption">不是{label}官方授权页，不读取你的真实账号</p>
        </div>
        <div className="pad">
          {redirectUri ? (
            <>
              <Hint tone="amber">仅使用虚拟身份。正式环境将跳转{provider === "wechat" ? "微信开放平台的扫码授权页" : "支付宝官方授权页"}。</Hint>
              <MockConsentForm
                action={`/api/mock/oauth/${provider}/authorize`}
                redirectUri={redirectUri.toString()}
                state={q.state ?? ""}
                personas={PERSONAS[provider].map((p) => ({ ...p, avatar: mockAvatar(p.name, p.hue) }))}
              />
            </>
          ) : (
            <Hint tone="red" icon="shield">
              redirect_uri 未登记：Mock 授权只会回到本应用自己的回调地址，请从登录页重新发起。
            </Hint>
          )}
        </div>
      </section>
      {q.state && (
        <p className="auth-context">
          state = <span className="mono">{q.state}</span>
        </p>
      )}
    </>
  );
}
