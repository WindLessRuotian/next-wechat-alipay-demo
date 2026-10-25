import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CheckoutClient from "@/components/CheckoutClient";
import OrderPage from "@/components/OrderPage";
import { requireSession } from "@/lib/auth/session";
import { TEST_ITEM } from "@/lib/catalog";
import { env } from "@/lib/env";
import { getOrderForUser } from "@/lib/payments/orders";

export const metadata: Metadata = { title: "确认订单" };

/**
 * Step 1: choose WeChat Pay or Alipay. After a WeChat Pay order is created the
 * browser comes back here with ?order=<id> and the Native QR code is shown on
 * /checkout itself (Alipay redirects to its cashier instead).
 */
export default async function Checkout({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { user } = await requireSession();
  const { order: orderId } = await searchParams;

  if (orderId) {
    const order = await getOrderForUser(orderId, user.id);
    if (!order) notFound();
    return <OrderPage order={order} />;
  }

  const e = env();
  return <CheckoutClient amountFen={TEST_ITEM.amountFen} ttlMinutes={e.ORDER_TTL_MINUTES} modes={{ wechat: e.wechatMode, alipay: e.alipayMode }} />;
}
