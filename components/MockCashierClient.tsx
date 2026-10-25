"use client";

import { useState } from "react";
import { Hint } from "@/components/ui/primitives";

/** Mock Alipay cashier buttons: POST a signed notify through the real handler, then return like the cashier does. */
export default function MockCashierClient({ orderId, returnUrl }: { orderId: string; returnUrl: string }) {
  const [busy, setBusy] = useState<"success" | "close" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function simulate(outcome: "success" | "close") {
    setBusy(outcome);
    try {
      const res = await fetch("/api/mock/pay/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome }),
      });
      const data = (await res.json().catch(() => ({}))) as { notify?: { status: number; body: string }; error?: string };
      setMsg(
        data.notify
          ? { ok: true, text: `通知接口返回 HTTP ${data.notify.status} ${JSON.stringify(data.notify.body)}，正在返回商户页面…` }
          : { ok: false, text: `模拟失败：${data.error ?? res.status}` },
      );
      // Like the real cashier: after paying, the browser goes back to return_url.
      if (data.notify) setTimeout(() => window.location.assign(returnUrl), 900);
      else setBusy(null);
    } catch {
      setMsg({ ok: false, text: "网络请求失败，请重试。" });
      setBusy(null);
    }
  }

  return (
    <>
      <div className="row wrap center" style={{ marginTop: 25 }}>
        <button type="button" className="btn primary" disabled={!!busy} onClick={() => simulate("success")}>
          {busy === "success" && <span className="spinner" aria-hidden="true" />}
          模拟付款成功
        </button>
        <button type="button" className="btn" disabled={!!busy} onClick={() => simulate("close")}>
          {busy === "close" && <span className="spinner" aria-hidden="true" />}
          模拟交易关闭
        </button>
        <a className="btn" href={`/orders/${orderId}`} aria-disabled={!!busy}>
          暂不支付
        </a>
      </div>
      {msg && (
        <Hint tone={msg.ok ? "green" : "red"} className="page-hint" icon={msg.ok ? "check" : "info"}>
          {msg.text}
        </Hint>
      )}
    </>
  );
}
