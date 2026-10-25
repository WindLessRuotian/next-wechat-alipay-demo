import { alipay } from "@/lib/alipay/client";
import { guardUserPost, isMobileUA, json, publicOrder } from "@/lib/http";
import { createOrder } from "@/lib/payments/orders";

/**
 * Create the order locally FIRST (pending), then build a signed cashier URL:
 * alipay.trade.page.pay on desktop, alipay.trade.wap.pay on mobile browsers (bonus).
 * Building the URL is local signing only — Alipay creates its trade when the cashier opens.
 */
export async function POST(req: Request) {
  const g = await guardUserPost(req);
  if (!g.ok) return g.response;

  const order = await createOrder(g.session.user.id, "alipay");
  const client = await alipay();
  const input = { outTradeNo: order.outTradeNo, subject: order.subject, amountFen: order.amountFen, timeExpire: order.expiresAt };
  const payUrl = isMobileUA(req) ? client.wapPayUrl(input) : client.pagePayUrl(input);
  return json({ order: publicOrder(order), payUrl }, 201);
}
