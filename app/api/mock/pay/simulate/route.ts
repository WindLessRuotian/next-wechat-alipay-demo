import { z } from "zod";
import { env } from "@/lib/env";
import { guardUserPost, json, jsonError, publicOrder } from "@/lib/http";
import { buildMockAlipayNotify } from "@/lib/mock/alipay-provider";
import { buildMockWechatSuccessNotify, failMockWechatTrade, type SignedHttpRequest } from "@/lib/mock/wechat-provider";
import { getOrderForUser } from "@/lib/payments/orders";
import { refreshOrder } from "@/lib/payments/sync";

/**
 * MOCK MODE ONLY. Plays the provider's part: produces a correctly signed
 * notification and POSTs it over HTTP to the real notify route — so the same
 * verification / decryption / idempotency code runs as in production.
 * `replay` re-sends the identical last notification to demonstrate idempotency.
 */

const Body = z.object({
  orderId: z.string().uuid(),
  outcome: z.enum(["success", "fail", "close", "replay"]),
});

const lastNotify = (globalThis as unknown as { __mockLastNotify?: Map<string, SignedHttpRequest> }).__mockLastNotify ?? new Map();
(globalThis as unknown as { __mockLastNotify: Map<string, SignedHttpRequest> }).__mockLastNotify = lastNotify;

export async function POST(req: Request) {
  const g = await guardUserPost(req);
  if (!g.ok) return g.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "bad_request");

  const order = await getOrderForUser(parsed.data.orderId, g.session.user.id);
  if (!order) return jsonError(404, "not_found");
  const mode = order.provider === "wechat" ? env().wechatMode : env().alipayMode;
  if (mode !== "mock") return jsonError(403, "not_in_mock_mode");

  const outcome = parsed.data.outcome;
  let notify: SignedHttpRequest | null = null;

  if (outcome === "replay") {
    notify = lastNotify.get(order.id) ?? null;
    if (!notify) return jsonError(409, "nothing_to_replay");
  } else if (order.provider === "wechat") {
    if (outcome === "success") notify = await buildMockWechatSuccessNotify(order.outTradeNo);
    else if (outcome === "fail") {
      await failMockWechatTrade(order.outTradeNo);
      const updated = await refreshOrder(order, { force: true });
      return json({ order: publicOrder(updated), notify: null, note: "WeChat sends no notification for failures; picked up by order query" });
    } else return jsonError(400, "use_close_endpoint");
  } else {
    if (outcome === "fail") return jsonError(400, "alipay_has_no_failure_notify");
    const params = await buildMockAlipayNotify(order.outTradeNo, outcome === "success" ? "TRADE_SUCCESS" : "TRADE_CLOSED");
    if (params) {
      notify = { body: new URLSearchParams(params).toString(), headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" } };
    }
  }
  if (!notify) return jsonError(409, "mock_trade_not_found", "Open the cashier / QR first");
  lastNotify.set(order.id, notify);

  const path = order.provider === "wechat" ? "/api/pay/wechat/notify" : "/api/pay/alipay/notify";
  const res = await fetch(new URL(path, env().APP_URL), { method: "POST", headers: notify.headers, body: notify.body });
  const responseBody = await res.text();
  const updated = (await getOrderForUser(order.id, g.session.user.id))!;
  return json({ order: publicOrder(updated), notify: { status: res.status, body: responseBody } });
}
