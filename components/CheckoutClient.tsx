"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ChannelIcon, Hint, Money, PageHeading, Steps } from "@/components/ui/primitives";
import { formatCny, ITEM_NAME, MODE_LABELS, payLabel, type ModeKey, type ProviderKey } from "@/lib/ui";

const DESCRIPTIONS: Record<ProviderKey, string> = {
  wechat: "创建订单后，使用微信扫码完成付款",
  alipay: "前往支付宝收银台，安全完成付款",
};

function secureNote(provider: ProviderKey, mode: ModeKey, amountFen: number): string {
  if (mode === "mock") return "当前为模拟体验，不会真实扣款";
  if (provider === "alipay" && mode === "sandbox") return "支付宝沙箱环境，请使用沙箱买家账号付款";
  return `将发起真实付款 ${formatCny(amountFen)}`;
}

const ERRORS: Record<string, string> = {
  unauthenticated: "登录已失效，请重新登录后再下单。",
  forbidden_origin: "请求来源校验未通过，请刷新页面后重试。",
};

export default function CheckoutClient({ amountFen, ttlMinutes, modes }: { amountFen: number; ttlMinutes: number; modes: Record<ProviderKey, ModeKey> }) {
  const [provider, setProvider] = useState<ProviderKey>("wechat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<{ orderId: string; payUrl: string } | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      // No amount in the request: the server decides what is being bought and for how much.
      const res = await fetch(`/api/pay/${provider}/create`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { order?: { id: string }; payUrl?: string; error?: string; message?: string };
      if (!res.ok || !data.order) {
        const code = data.error ?? `HTTP ${res.status}`;
        throw new Error(ERRORS[code] ?? `渠道下单失败（${data.message ?? code}），请稍后重试。`);
      }
      if (provider === "alipay" && data.payUrl) {
        setRedirect({ orderId: data.order.id, payUrl: data.payUrl });
        window.location.assign(data.payUrl); // to the Alipay cashier (or the mock one)
      } else {
        // A full navigation on purpose: client navigation keeps the shared layout, so the
        // sidebar order count would stay stale. The QR code is then shown on /checkout itself.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/checkout?order=${encodeURIComponent(data.order.id)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (redirect) {
    return (
      <>
        <PageHeading title="前往支付宝支付" desc="订单已创建，接下来将在支付宝收银台完成付款。" />
        <Steps current={1} />
        <section className="card success-panel bridge-panel">
          <div className="result-icon blue">
            <Icon name="external" />
          </div>
          <h2>正在前往支付宝收银台</h2>
          <p className="muted" style={{ fontSize: 13, margin: "10px 0 23px" }}>
            请在收银台确认金额，完成支付后会回到本应用。
          </p>
          <Money fen={amountFen} />
          <Hint tone="blue" className="bridge-hint">
            {modes.alipay === "mock"
              ? "Mock 模式进入本地模拟收银台：请求签名与正式环境一致，模拟收银台会先验签再展示订单，不发生真实扣款。"
              : "即将进入支付宝官方收银台。返回本应用后，订单状态以服务端收到的异步通知或主动查单结果为准。"}
          </Hint>
          <div className="row center" style={{ marginTop: 21 }}>
            <a className="btn primary" href={redirect.payUrl}>
              立即前往
            </a>
            <Link className="btn" href={`/orders/${redirect.orderId}`}>
              查看订单
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="确认订单"
        desc="选择支付方式，开始安全便捷的付款体验。"
        extra={
          <Link className="btn" href="/dashboard">
            <Icon name="back" />
            返回控制台
          </Link>
        }
      />
      <Steps current={0} />
      <div className="checkout-grid">
        <section className="card checkout-main-card">
          <div className="card-head">
            <h2>商品与支付方式</h2>
            <span className="tag">01 / 确认</span>
          </div>
          <div className="pad">
            <div className="row summary-item">
              <span className="product-tile sm">
                <Icon name="box" />
              </span>
              <div className="flex1">
                <h3>{ITEM_NAME}</h3>
                <p className="caption">Test item · 一次完整的支付流程</p>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                × 1
              </span>
            </div>
            <div className="divider" />
            <h3 style={{ marginBottom: 15 }} id="pay-method-label">
              选择支付方式
            </h3>
            <div className="stack" style={{ gap: 13 }} role="radiogroup" aria-labelledby="pay-method-label">
              {(["wechat", "alipay"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={provider === p}
                  className={`payment-option ${provider === p ? "selected" : ""}`}
                  onClick={() => setProvider(p)}
                  disabled={busy}
                >
                  <ChannelIcon provider={p} />
                  <div>
                    <strong>{payLabel(p)}</strong>
                    <span className="tag mode">{MODE_LABELS[modes[p]]}</span>
                    <div className="sub">{DESCRIPTIONS[p]}</div>
                  </div>
                  <span className="radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            <Hint tone="blue" icon="shield" className="checkout-hint">
              订单金额由服务端确定，浏览器不能修改价格。
              <br />
              支付成功后，以服务端确认的订单状态为准。
            </Hint>
          </div>
        </section>

        <section className="card checkout-summary">
          <div className="card-head">
            <h2>订单摘要</h2>
          </div>
          <div className="pad">
            <div className="summary-item">
              <h3>{ITEM_NAME}</h3>
              <p className="caption">SKU · test-item-001</p>
            </div>
            <div className="summary-line" style={{ marginTop: 13 }}>
              <span>商品金额</span>
              <strong>{formatCny(amountFen)}</strong>
            </div>
            <div className="summary-line">
              <span>购买数量</span>
              <strong>1 件</strong>
            </div>
            <div className="summary-line">
              <span>支付渠道</span>
              <strong>{payLabel(provider)}</strong>
            </div>
            <div className="summary-line">
              <span>订单有效期</span>
              <strong>{ttlMinutes} 分钟</strong>
            </div>
            <div className="summary-total">
              <span className="quiet" style={{ fontSize: 12 }}>
                应付金额
              </span>
              <Money fen={amountFen} />
            </div>
            <div className="checkout-submit">
              {error && (
                <Hint tone="red" className="checkout-error">
                  {error}
                </Hint>
              )}
              <button type="button" className="btn primary block" onClick={pay} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    正在创建订单…
                  </>
                ) : (
                  <>
                    确认并支付 {formatCny(amountFen)} <Icon name="arrow" small />
                  </>
                )}
              </button>
              <p className="secure-note">
                <Icon name="lock" />
                {secureNote(provider, modes[provider], amountFen)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
