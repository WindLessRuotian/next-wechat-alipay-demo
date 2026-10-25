"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicOrder } from "@/lib/http";

const POLL_MS = 2000;
const yuan = (fen: number) => `¥${Math.floor(fen / 100)}.${String(fen % 100).padStart(2, "0")}`;

export default function OrderStatusClient({ initial, qrDataUrl, mock }: { initial: PublicOrder; qrDataUrl: string | null; mock: boolean }) {
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const pending = order.status === "pending";
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const note = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 8));

  const poll = useCallback(async () => {
    const res = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
    if (res.ok) setOrder(((await res.json()) as { order: PublicOrder }).order);
  }, [order.id]);

  // Poll the SERVER while pending; the browser never decides the status itself.
  useEffect(() => {
    if (!pending) return;
    const tick = async () => {
      await poll().catch(() => undefined);
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

  async function post(url: string, body: unknown, label: string) {
    setBusy(label);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { order?: PublicOrder; notify?: { status: number; body: string } | null; error?: string; note?: string };
      if (data.order) setOrder(data.order);
      if (data.notify) note(`${label}: notify handler replied HTTP ${data.notify.status} ${JSON.stringify(data.notify.body)}`);
      else if (data.note) note(`${label}: ${data.note}`);
      else if (!res.ok) note(`${label}: ${data.error ?? res.status}`);
    } finally {
      setBusy(null);
    }
  }

  const secondsLeft = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000));

  return (
    <div className="stack">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>
            {order.subject} · {yuan(order.amountFen)}
          </h2>
          <span className={`badge ${order.status}`} aria-live="polite">
            {order.status}
          </span>
        </div>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Order no.</dt>
          <dd className="mono">{order.outTradeNo}</dd>
          <dt>Provider</dt>
          <dd>{order.provider === "wechat" ? "WeChat Pay (Native)" : "Alipay"}</dd>
          {order.providerTradeNo && (
            <>
              <dt>Provider trade no.</dt>
              <dd className="mono">{order.providerTradeNo}</dd>
            </>
          )}
          {order.paidAt && (
            <>
              <dt>Paid at</dt>
              <dd>{new Date(order.paidAt).toLocaleString()}</dd>
            </>
          )}
          {order.failureReason && (
            <>
              <dt>Reason</dt>
              <dd>{order.failureReason}</dd>
            </>
          )}
          {pending && (
            <>
              <dt>Expires in</dt>
              <dd>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </dd>
            </>
          )}
        </dl>
      </section>

      {pending && order.provider === "wechat" && qrDataUrl && (
        <section className="card">
          <h2>Scan with WeChat</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr" src={qrDataUrl} alt="WeChat Pay QR code" />
          <p className="mono muted">{order.codeUrl}</p>
          <p className="muted">This page checks with the server every {POLL_MS / 1000}s.</p>
        </section>
      )}

      {pending && (
        <div className="row">
          {mock && order.provider === "wechat" && (
            <>
              <button className="btn wechat" disabled={!!busy} onClick={() => post("/api/mock/pay/simulate", { orderId: order.id, outcome: "success" }, "Simulate payment success")}>
                Simulate payment success
              </button>
              <button className="btn" disabled={!!busy} onClick={() => post("/api/mock/pay/simulate", { orderId: order.id, outcome: "fail" }, "Simulate payment failure")}>
                Simulate payment failure
              </button>
            </>
          )}
          <button className="btn" disabled={!!busy} onClick={() => post(`/api/orders/${order.id}/close`, {}, "Cancel order")}>
            Cancel order
          </button>
        </div>
      )}

      {mock && !pending && (
        <div className="row">
          <button className="btn small" disabled={!!busy} onClick={() => post("/api/mock/pay/simulate", { orderId: order.id, outcome: "replay" }, "Replay last notification")}>
            Replay last notification (idempotency check)
          </button>
        </div>
      )}

      {log.length > 0 && (
        <section className="card">
          <h2>Mock provider log</h2>
          <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
        </section>
      )}
    </div>
  );
}
