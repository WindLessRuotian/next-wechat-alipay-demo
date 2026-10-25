"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Channel, ChannelIcon, DetailList, Hint, Money, PageHeading, StatusBadge, Steps } from "@/components/ui/primitives";
import type { PublicOrder } from "@/lib/http";
import { failureLabel, formatCny, formatTime, itemName } from "@/lib/ui";

const POLL_MS = 2000;

const MOCK_MESSAGES: Record<string, string> = {
  nothing_to_replay: "还没有可重放的通知，请先模拟一次付款。",
  mock_trade_not_found: "模拟交易尚未创建：请先打开收银台或二维码。",
  not_in_mock_mode: "该渠道不是 Mock 模式，模拟工具不可用。",
  alipay_has_no_failure_notify: "支付宝没有“支付失败”通知，请改用模拟交易关闭。",
};

type Action = { label: string; outcome: "success" | "fail" | "close" | "replay"; primary?: boolean };

function mockActions(order: PublicOrder): Action[] {
  if (order.status !== "pending") return [{ label: "重放通知", outcome: "replay" }];
  return order.provider === "wechat"
    ? [
        { label: "模拟支付成功", outcome: "success", primary: true },
        { label: "模拟支付失败", outcome: "fail" },
      ]
    : [
        { label: "模拟付款成功", outcome: "success", primary: true },
        { label: "模拟交易关闭", outcome: "close" },
      ];
}

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")} : ${String(seconds % 60).padStart(2, "0")}`;
const timeOf = (iso: string) => formatTime(iso).slice(11);

export default function OrderStatusClient({
  initial,
  qrDataUrl,
  mock,
  serverNow,
  fromReturn,
}: {
  initial: PublicOrder;
  qrDataUrl: string | null;
  mock: boolean;
  /** Server clock at render time, so the first countdown frame matches the HTML. */
  serverNow: number;
  fromReturn: boolean;
}) {
  const [order, setOrder] = useState(initial);
  const [now, setNow] = useState(serverNow);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = order.status === "pending";

  const note = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString("zh-CN", { hour12: false })}  ${s}`, ...l].slice(0, 6));

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOrder(((await res.json()) as { order: PublicOrder }).order);
      setOffline(false);
    } catch {
      // Keep the last known server state; never decide the outcome in the browser.
      setOffline(true);
    }
  }, [order.id]);

  // Poll the SERVER while pending; stop as soon as it reports a terminal state.
  useEffect(() => {
    if (!pending) return;
    const tick = async () => {
      await poll();
      timer.current = setTimeout(tick, POLL_MS);
    };
    timer.current = setTimeout(tick, POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pending, poll]);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending]);

  async function post(url: string, body: unknown, label: string): Promise<boolean> {
    setBusy(label);
    setProblem(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { order?: PublicOrder; notify?: { status: number; body: string } | null; error?: string; note?: string };
      if (data.order) setOrder(data.order);
      if (data.notify) note(`${label}：通知接口返回 HTTP ${data.notify.status} ${JSON.stringify(data.notify.body)}`);
      else if (data.note) note(`${label}：微信支付失败不发送通知，已通过主动查单同步`);
      else if (!res.ok) note(`${label}：${MOCK_MESSAGES[data.error ?? ""] ?? data.error ?? `HTTP ${res.status}`}`);
      return res.ok;
    } catch {
      note(`${label}：网络请求失败`);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setConfirmCancel(false);
    const ok = await post(`/api/orders/${order.id}/close`, {}, "取消订单");
    if (!ok) setProblem("关闭订单失败：渠道暂时不可用，订单仍保持待支付，请稍后重试。");
  }

  const secondsLeft = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000));
  const name = itemName(order.subject);

  const facts: [string, React.ReactNode, string?][] = [
    ["商品名称", name],
    ["订单编号", order.outTradeNo, "mono"],
    ["支付渠道", <Channel key="channel" provider={order.provider} />],
    ["订单金额", formatCny(order.amountFen), "number-cell"],
    ["创建时间", formatTime(order.createdAt)],
  ];
  if (pending) facts.push(["失效时间", formatTime(order.expiresAt)]);
  if (order.paidAt) facts.push(["支付时间", formatTime(order.paidAt)]);
  if (order.closedAt) facts.push(["关闭时间", formatTime(order.closedAt)]);
  if (order.providerTradeNo) facts.push(["渠道交易号", order.providerTradeNo, "mono"]);
  if (order.failureReason && !pending) facts.push(["原因", failureLabel(order.failureReason)]);

  return (
    <>
      <PageHeading
        title={pending ? "完成支付" : "订单详情"}
        desc={pending ? "订单已创建，请在有效期内完成付款。" : "每一笔交易，都有清晰可追踪的状态。"}
        extra={
          <Link className="btn" href="/orders">
            <Icon name="back" />
            {pending ? "我的订单" : "返回订单列表"}
          </Link>
        }
      />
      <Steps current={pending ? 1 : 2} />
      {fromReturn && (
        <Hint tone="blue" className="page-hint">
          已从支付宝返回。下方状态由服务端确认（异步通知或主动查单），不以浏览器跳转为准。
        </Hint>
      )}

      <div className="pay-grid">
        <div className="stack" style={{ gap: 0 }}>
          {pending && order.provider === "wechat" && (
            <section className="card qr-card">
              <div className="row center" style={{ gap: 8 }}>
                <ChannelIcon provider="wechat" size="tiny" />
                <strong style={{ fontSize: 15 }}>微信扫码支付</strong>
              </div>
              <Money fen={order.amountFen} />
              <p className="muted" style={{ fontSize: 12 }}>
                {name}
              </p>
              {qrDataUrl ? (
                <div className="qr-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URL rendered on the server */}
                  <img src={qrDataUrl} alt="微信支付二维码" />
                  {mock && <span className="qr-seal">MOCK</span>}
                </div>
              ) : (
                <Hint tone="amber">二维码暂不可用，请返回重新下单。</Hint>
              )}
              <p className="qr-caption">
                <span className="desktop-only">打开微信「扫一扫」完成付款</span>
                <span className="mobile-only">请使用另一台设备上的微信扫码</span>
                {mock && (
                  <>
                    <br />
                    <span className="warn">Mock 二维码仅用于演示，不能用于真实付款</span>
                  </>
                )}
              </p>
              <PendingFooter secondsLeft={secondsLeft} onCancel={() => setConfirmCancel(true)} busy={!!busy} />
            </section>
          )}

          {pending && order.provider === "alipay" && (
            <section className="card qr-card">
              <div className="row center" style={{ gap: 8 }}>
                <ChannelIcon provider="alipay" size="tiny" />
                <strong style={{ fontSize: 15 }}>支付宝支付</strong>
              </div>
              <Money fen={order.amountFen} />
              <p className="muted" style={{ fontSize: 12 }}>
                {name}
              </p>
              <div className="result-icon blue" style={{ margin: "22px auto 12px" }}>
                <Icon name="external" />
              </div>
              <p className="qr-caption">
                请在支付宝收银台完成付款。
                <br />
                付款后无需停留在收银台，本页会自动同步服务端结果。
              </p>
              <PendingFooter secondsLeft={secondsLeft} onCancel={() => setConfirmCancel(true)} busy={!!busy} />
            </section>
          )}

          {!pending && <ResultPanel order={order} name={name} />}

          {offline && pending && (
            <Hint tone="amber" icon="cloud" className="page-hint">
              <strong>网络连接暂时中断</strong>
              <br />
              尚未取得新的服务端结果，订单仍保留待支付状态。如果渠道已显示扣款，请勿重复付款。
              <div className="hint-actions">
                <button type="button" className="link-btn" onClick={poll}>
                  重新查询
                </button>
              </div>
            </Hint>
          )}
          {problem && (
            <Hint tone="red" className="page-hint">
              {problem}
            </Hint>
          )}

          {mock && (
            <section className="mock-panel" aria-label="模拟支付工具">
              <div className="title">
                <Icon name="code" small />
                模拟支付工具 <span className="tag">仅 Mock 可见</span>
              </div>
              <p>
                {pending
                  ? "按钮会生成带正确签名的渠道通知，并通过 HTTP 发送到真实的通知接口；验签、解密、金额核对与幂等都会执行。"
                  : "重放会把上一次通知原样再发一次，用来验证幂等：订单不会被重复更新。"}
              </p>
              <div className="row">
                {mockActions(order).map((a) => (
                  <button
                    key={a.outcome}
                    type="button"
                    className={`btn sm ${a.primary ? "primary" : ""}`}
                    disabled={!!busy}
                    onClick={() => post("/api/mock/pay/simulate", { orderId: order.id, outcome: a.outcome }, a.label)}
                  >
                    {busy === a.label && <span className="spinner" aria-hidden="true" />}
                    {a.label}
                  </button>
                ))}
              </div>
              {log.length > 0 && (
                <ul className="mock-log" aria-live="polite">
                  {log.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="stack pay-side">
          <section className="card">
            <div className="card-head">
              <h2>订单信息</h2>
              <span aria-live="polite">
                <StatusBadge status={order.status} />
              </span>
            </div>
            <div className="pad">
              <DetailList items={facts} />
            </div>
          </section>
          <section className="card pad">
            {pending || order.status === "paid" ? (
              <>
                <h3>订单进度</h3>
                <ol className="timeline">
                  <li className="done">
                    订单已创建
                    <small>{timeOf(order.createdAt)} · 服务端生成订单与金额</small>
                  </li>
                  {pending ? (
                    <>
                      <li className="current">
                        等待完成支付
                        <small>使用所选渠道付款，页面每 2 秒向服务端同步</small>
                      </li>
                      <li>
                        等待订单完成
                        <small>支付结果以服务端确认为准</small>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="done">
                        支付结果已确认
                        <small>{order.paidAt ? `${timeOf(order.paidAt)} · ` : ""}渠道结果验签、金额核对通过</small>
                      </li>
                      <li className="done">
                        订单已完成
                        <small>本地订单状态更新为 paid</small>
                      </li>
                    </>
                  )}
                </ol>
              </>
            ) : (
              <>
                <h3>下一步可以做什么？</h3>
                <p className="caption" style={{ margin: "13px 0 18px" }}>
                  重新创建订单，或在订单列表查看其他交易。
                </p>
                <Hint>如果渠道显示已扣款而订单未更新，请等待服务端确认，勿重复付款。</Hint>
              </>
            )}
          </section>
        </aside>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="确认取消这笔订单？"
        actions={
          <>
            <button type="button" className="btn" onClick={() => setConfirmCancel(false)}>
              继续支付
            </button>
            <button type="button" className="btn danger" onClick={cancel}>
              确认取消
            </button>
          </>
        }
      >
        <p>取消后这笔订单将不能继续支付，如需购买请重新创建订单。服务端会先在渠道侧关单；如果渠道显示已付款，以付款结果为准。</p>
      </Modal>
    </>
  );
}

function PendingFooter({ secondsLeft, onCancel, busy }: { secondsLeft: number; onCancel: () => void; busy: boolean }) {
  return (
    <>
      <div className="countdown">
        <Icon name="clock" small />
        {secondsLeft > 0 ? (
          <>
            请在 <strong>{clock(secondsLeft)}</strong> 内完成付款
          </>
        ) : (
          "已超过有效期，等待服务端确认关闭"
        )}
      </div>
      <div className="waiting-line">
        <span className="spinner" aria-hidden="true" />
        等待服务端确认支付结果 · 自动同步
      </div>
      <button type="button" className="link-btn subtle" onClick={onCancel} disabled={busy}>
        取消订单
      </button>
    </>
  );
}

const RESULTS = {
  paid: { title: "支付成功", desc: "服务端已确认支付结果，订单已完成。", icon: "check", tone: "" },
  failed: { title: "支付失败", desc: "本次支付未完成，请重新创建订单后再试。", icon: "close", tone: "red" },
  closed: { title: "订单已关闭", desc: "这笔订单已取消或超时，请重新创建订单。", icon: "clock", tone: "gray" },
} as const;

function ResultPanel({ order, name }: { order: PublicOrder; name: string }) {
  const r = RESULTS[order.status as keyof typeof RESULTS] ?? RESULTS.closed;
  const paid = order.status === "paid";
  const when = order.paidAt ?? order.closedAt;
  return (
    <section className="card success-panel">
      <div className={`result-icon ${r.tone}`}>
        <Icon name={r.icon} />
      </div>
      <h2>{r.title}</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        {r.desc}
      </p>
      <Money fen={order.amountFen} />
      <StatusBadge status={order.status}>{paid ? "已验证的服务端结果" : undefined}</StatusBadge>
      <div className="receipt">
        <div className="summary-line">
          <span>商品名称</span>
          <strong>{name}</strong>
        </div>
        <div className="summary-line">
          <span>订单编号</span>
          <strong className="mono">{order.outTradeNo}</strong>
        </div>
        {when && (
          <div className="summary-line">
            <span>{paid ? "支付时间" : "状态更新时间"}</span>
            <strong>{formatTime(when)}</strong>
          </div>
        )}
        {!paid && order.failureReason && (
          <div className="summary-line">
            <span>原因</span>
            <strong>{failureLabel(order.failureReason)}</strong>
          </div>
        )}
      </div>
      <Hint tone={paid ? "green" : undefined} icon="shield">
        {paid
          ? "状态由渠道异步通知验签或服务端主动查单确认，不依赖浏览器跳转。"
          : "终态订单不再继续支付。重新购买会创建新的订单编号，避免复用失效交易。"}
      </Hint>
      <div className="row center wrap">
        <Link className="btn" href="/orders">
          查看我的订单
        </Link>
        <Link className="btn primary" href="/checkout">
          {paid ? "继续体验" : "重新购买"}
        </Link>
      </div>
    </section>
  );
}
