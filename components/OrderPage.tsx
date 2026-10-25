import QRCode from "qrcode";
import OrderStatusClient from "@/components/OrderStatusClient";
import type { Order } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { publicOrder } from "@/lib/http";
import { refreshOrder } from "@/lib/payments/sync";

/** Refresh from the provider if due and render the Native code_url as a QR code. */
async function loadView(order: Order, fromReturn: boolean) {
  const fresh = await refreshOrder(order);
  const e = env();
  const mock = (fresh.provider === "wechat" ? e.wechatMode : e.alipayMode) === "mock";
  const qrDataUrl =
    fresh.provider === "wechat" && fresh.status === "pending" && fresh.codeUrl
      ? // Mock QRs carry a centred "MOCK" seal, so use the highest error correction there.
        await QRCode.toDataURL(fresh.codeUrl, { margin: 1, width: 440, errorCorrectionLevel: mock ? "H" : "M" })
      : null;
  // The server clock seeds the countdown so the first client frame matches the HTML.
  return { initial: publicOrder(fresh), qrDataUrl, mock, serverNow: Date.now(), fromReturn };
}

/** Server half of the order view, shared by /orders/[id] and /checkout?order=…. */
export default async function OrderPage({ order, fromReturn = false }: { order: Order; fromReturn?: boolean }) {
  return <OrderStatusClient {...await loadView(order, fromReturn)} />;
}
