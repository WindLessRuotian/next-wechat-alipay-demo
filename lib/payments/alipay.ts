import "server-only";
import type { OrderStatus } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { yuanToFen } from "@/lib/money";
import { fromBeijingDateTime } from "@/lib/time";
import { alipayConfig } from "@/lib/alipay/config";
import { verifyNotify, type Params } from "@/lib/alipay/sign";
import type { AlipayTradeQuery } from "@/lib/alipay/client";
import { applyVerifiedEvent } from "./orders";
import type { HttpReply } from "./wechat";

export function alipayStateToStatus(state: AlipayTradeQuery["trade_status"]): OrderStatus {
  switch (state) {
    case "TRADE_SUCCESS":
    case "TRADE_FINISHED":
      return "paid";
    case "TRADE_CLOSED":
      return "closed";
    case "WAIT_BUYER_PAY":
    default:
      return "pending";
  }
}

/** Alipay retries until it reads exactly the 7 characters "success" in the body. */
const SUCCESS: HttpReply = { status: 200, body: "success", contentType: "text/plain; charset=utf-8" };
const FAILURE: HttpReply = { status: 200, body: "fail", contentType: "text/plain; charset=utf-8" };

/** Parse an application/x-www-form-urlencoded body into a flat map (values URL-decoded). */
export function parseFormBody(raw: string): Params {
  const out: Params = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

/**
 * Alipay async notification handler (framework-agnostic, unit-tested).
 *  1. verify RSA2 signature (drop sign & sign_type, sort, k=v&…) with the Alipay public key
 *  2. check app_id (and seller_id if configured)
 *  3. check out_trade_no exists and total_amount equals the stored amount
 *  4. apply idempotently, keyed by notify_id
 *  5. reply "success" (plain text); anything else makes Alipay retry
 */
export async function handleAlipayNotify(rawBody: string): Promise<HttpReply> {
  const cfg = alipayConfig();
  const params = parseFormBody(rawBody);

  const v = verifyNotify(params, cfg.alipayPublicKey);
  if (!v.ok) {
    log.warn("alipay.notify_rejected", { reason: v.reason, outTradeNo: params.out_trade_no });
    return FAILURE;
  }
  if (params.app_id !== cfg.appId) {
    log.error("alipay.notify_app_mismatch", { appId: params.app_id });
    return FAILURE;
  }
  if (cfg.sellerId && params.seller_id && params.seller_id !== cfg.sellerId) {
    log.error("alipay.notify_seller_mismatch", { outTradeNo: params.out_trade_no });
    return FAILURE;
  }
  if (!params.notify_id || !params.out_trade_no || !params.trade_status) {
    log.warn("alipay.notify_incomplete", { keys: Object.keys(params).join(",") });
    return FAILURE;
  }

  const amountFen = yuanToFen(params.total_amount ?? "");
  const occurredAt = fromBeijingDateTime(params.gmt_payment ?? params.gmt_close ?? "") ?? undefined;
  const result = await applyVerifiedEvent({
    provider: "alipay",
    eventId: params.notify_id,
    source: "notify",
    eventType: params.trade_status,
    outTradeNo: params.out_trade_no,
    target: alipayStateToStatus(params.trade_status as AlipayTradeQuery["trade_status"]),
    amountFen: amountFen ?? -1,
    providerTradeNo: params.trade_no,
    occurredAt,
  });
  log.info("alipay.notify_processed", { notifyId: params.notify_id, outTradeNo: params.out_trade_no, outcome: result.outcome, reason: result.reason });

  // Signed but inconsistent (unknown order / amount mismatch) will not fix itself on retry.
  return SUCCESS;
}
