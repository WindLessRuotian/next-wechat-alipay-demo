import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { publicOrder } from "@/lib/http";
import { getOrderForUser } from "@/lib/payments/orders";
import { refreshOrder } from "@/lib/payments/sync";
import OrderStatusClient from "@/components/OrderStatusClient";

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { user } = await requireSession();
  const { id } = await params;
  const { from } = await searchParams;
  const order = await getOrderForUser(id, user.id);
  if (!order) notFound();
  const fresh = await refreshOrder(order);
  const qrDataUrl =
    fresh.provider === "wechat" && fresh.status === "pending" && fresh.codeUrl
      ? await QRCode.toDataURL(fresh.codeUrl, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      : null;
  const e = env();
  const mock = (fresh.provider === "wechat" ? e.wechatMode : e.alipayMode) === "mock";

  return (
    <>
      <h1>Order</h1>
      {from === "return" && (
        <p className="alert">
          Returned from Alipay. The status below is confirmed by the server (notification or order query), not by this redirect.
        </p>
      )}
      <OrderStatusClient initial={publicOrder(fresh)} qrDataUrl={qrDataUrl} mock={mock} />
    </>
  );
}
