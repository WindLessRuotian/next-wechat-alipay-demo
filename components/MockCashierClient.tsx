"use client";

import { useState } from "react";

export default function MockCashierClient({ orderId, returnUrl }: { orderId: string; returnUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function simulate(outcome: "success" | "close") {
    setBusy(true);
    const res = await fetch("/api/mock/pay/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, outcome }),
    });
    const data = (await res.json()) as { notify?: { status: number; body: string }; error?: string };
    setMsg(data.notify ? `notify handler replied ${JSON.stringify(data.notify.body)}` : (data.error ?? "error"));
    // Like the real cashier: after paying, the browser goes back to return_url.
    setTimeout(() => window.location.assign(returnUrl), 900);
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn alipay" disabled={busy} onClick={() => simulate("success")}>
          Simulate payment success
        </button>
        <button className="btn" disabled={busy} onClick={() => simulate("close")}>
          Simulate TRADE_CLOSED notification
        </button>
        <a className="btn" href={`/orders/${orderId}`}>
          Cancel (leave without paying)
        </a>
      </div>
      {msg && <p className="alert">{msg}</p>}
    </div>
  );
}
