import { clientIp, guardUserPost, json, jsonError, publicOrder } from "@/lib/http";
import { log } from "@/lib/log";
import { createOrder, getOrder, markFailedToCreate, setCodeUrl } from "@/lib/payments/orders";
import { ProviderError } from "@/lib/payments/errors";
import { wechatPay } from "@/lib/wechat/pay-client";

/**
 * Create the order locally FIRST (pending), then ask WeChat Pay for a Native code_url.
 * The request body is ignored on purpose: amount & item come from the server catalog.
 */
export async function POST(req: Request) {
  const g = await guardUserPost(req);
  if (!g.ok) return g.response;

  const order = await createOrder(g.session.user.id, "wechat");
  try {
    const { codeUrl } = await wechatPay().createNative({
      outTradeNo: order.outTradeNo,
      description: order.subject,
      amountFen: order.amountFen,
      timeExpire: order.expiresAt,
      clientIp: clientIp(req),
    });
    await setCodeUrl(order.id, codeUrl);
    return json({ order: publicOrder((await getOrder(order.id))!) }, 201);
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : "INTERNAL";
    log.error("wechatpay.create_failed", { orderId: order.id, code });
    await markFailedToCreate(order.id, `create failed: ${code}`);
    return jsonError(502, "provider_error", code);
  }
}
