import { redirect } from "next/navigation";
import { EnvironmentBanner } from "@/components/shell/EnvironmentBanner";
import { Icon } from "@/components/ui/Icon";
import { InfoDialogButton } from "@/components/ui/Modal";
import { Brand, ChannelIcon, Hint } from "@/components/ui/primitives";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { BRAND, ERROR_MESSAGES, MODE_LABELS, type ModeKey } from "@/lib/ui";

function ModeHint({ wechat, alipay }: { wechat: ModeKey; alipay: ModeKey }) {
  if (wechat === "mock" && alipay === "mock") {
    return (
      <Hint tone="amber">
        <strong>当前为 Mock 模拟模式</strong>
        <br />
        将进入本地授权页，使用示例身份体验。
        <br />
        正式环境将跳转对应平台的官方授权页面。
      </Hint>
    );
  }
  const line = (label: string, mode: ModeKey) =>
    mode === "mock" ? `${label}：Mock，进入本地授权页` : `${label}：${MODE_LABELS[mode]}，跳转${label}官方授权页`;
  return (
    <Hint tone={wechat === "mock" || alipay === "mock" ? "amber" : "blue"}>
      <strong>按渠道区分的登录环境</strong>
      <br />
      {line("微信", wechat)}
      <br />
      {line("支付宝", alipay)}
    </Hint>
  );
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  const e = env();

  return (
    <div className="login-shell">
      <EnvironmentBanner wechat={e.wechatMode} alipay={e.alipayMode} />
      <div className="login-page">
        <section className="login-story">
          <Brand />
          <div className="login-story-copy">
            <div className="eyebrow">ONE ACCOUNT. TWO CONNECTIONS.</div>
            <h1>
              连接每一次登录，
              <br />
              <span>安心完成每一笔支付。</span>
            </h1>
            <p>
              微信与支付宝，一站式授权登录与支付体验。
              <br />
              从身份确认到订单完成，让每一步都有迹可循。
            </p>
          </div>
          <div className="connection-scene" aria-hidden="true">
            <div className="connection-wire" />
            <div className="connect-node wx">
              <ChannelIcon provider="wechat" />
              微信授权
            </div>
            <div className="connect-node ali">
              <ChannelIcon provider="alipay" />
              支付宝授权
            </div>
            <div className="connect-core">
              <Icon name="bridge" />
            </div>
            <div className="connect-result">
              <div className="row">
                <span className="check">
                  <Icon name="check" />
                </span>
                <div className="flex1">
                  <strong>统一身份，安全连接</strong>
                  <br />
                  <small>OAuth 2.0 · state 校验 · 服务端会话</small>
                </div>
              </div>
            </div>
          </div>
          <div className="trust-row">
            <span>
              <Icon name="shield" />
              官方授权流程
            </span>
            <span>
              <Icon name="lock" />
              服务端安全校验
            </span>
            <span>
              <Icon name="file" />
              订单状态可追踪
            </span>
          </div>
        </section>

        <section className="login-content">
          <div className="row login-top">
            <span>首次使用？授权后自动创建账号</span>
          </div>
          <div className="login-mobile-logo">
            <Brand />
          </div>
          <div className="login-form">
            {error && (
              <Hint tone="red" icon="shield">
                {ERROR_MESSAGES[error] ?? "登录未完成，请重新选择登录方式。"}
              </Hint>
            )}
            <div className="eyebrow">WELCOME TO {BRAND.toUpperCase()}</div>
            <h2>欢迎登录</h2>
            <p>选择你的常用账号，开始体验。</p>
            <div className="login-methods">
              {/* Plain links: the server sets the signed state cookie, then 302s to the provider. */}
              <a className="login-btn" href="/api/auth/wechat/login">
                <ChannelIcon provider="wechat" />
                使用微信登录
                <Icon name="arrow" small />
              </a>
              <a className="login-btn" href="/api/auth/alipay/login">
                <ChannelIcon provider="alipay" />
                使用支付宝登录
                <Icon name="arrow" small />
              </a>
            </div>
            <div className="login-or">无需单独设置密码</div>
            <div className="row login-safe">
              <Icon name="shield" small />
              账号授权与付款确认相互独立
            </div>
            <ModeHint wechat={e.wechatMode} alipay={e.alipayMode} />
            <div className="login-consent">
              首次授权后将建立本地账号，仅用于本演示的身份展示与订单关联。
              <InfoDialogButton label="查看数据使用说明" title="数据使用说明" icon="shield">
                <p>授权成功后，服务端只保存渠道用户 ID（openid / unionid 或支付宝 user ID）、昵称、头像，以及与本地订单的关联关系。</p>
                <p>授权码换取令牌、签名与验签全部在服务端完成；浏览器只持有一个 httpOnly 会话 Cookie，数据库中仅保存其 HMAC 摘要。退出登录会删除该会话。</p>
              </InfoDialogButton>
            </div>
          </div>
          <footer className="login-footer">
            © 2026 {BRAND} · 登录与支付集成演示
          </footer>
        </section>
      </div>
    </div>
  );
}
