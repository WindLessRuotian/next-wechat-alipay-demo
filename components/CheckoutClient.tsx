"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Provider = "wechat" | "alipay";

export default function CheckoutClient() {
  const router = useRouter();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(provider: Provider) {
    setBusy(provider);
    setError(null);
    try {
      // No amount in the request: the server decides what is being bought.
      const res = await fetch(`/api/pay/${provider}/create`, { method: "POST" });
      const data = (await res.json()) as { order?: { id: string }; payUrl?: string; error?: string; message?: string };
      if (!res.ok || !data.order) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      if (provider === "alipay" && data.payUrl) {
        window.location.assign(data.payUrl); // to the Alipay cashier (or the mock one)
      } else {
        router.push(`/orders/${data.order.id}`); // order page renders the Native QR code
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn wechat" disabled={busy !== null} onClick={() => pay("wechat")}>
          {busy === "wechat" ? "Creating order…" : "Pay with WeChat Pay (QR)"}
        </button>
        <button className="btn alipay" disabled={busy !== null} onClick={() => pay("alipay")}>
          {busy === "alipay" ? "Redirecting…" : "Pay with Alipay"}
        </button>
      </div>
      {error && <p className="alert error">Could not create the payment: {error}</p>}
    </div>
  );
}
