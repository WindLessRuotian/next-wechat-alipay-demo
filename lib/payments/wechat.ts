import "server-only";
import type { OrderStatus } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { wechatPayConfig } from "@/lib/wechat/pay-config";
import {
  decryptResource,
  readSignedHeaders,
  verifyWechatSignature,
  type WechatNotification,
  type WechatTransaction,
} from "@/lib/wechat/pay-crypto";
import { applyVerifiedEvent, type ApplyResult } from "./orders";

export function wechatStateToStatus(state: WechatTransaction["trade_state"]): OrderStatus {
  switch (state) {
    case "SUCCESS":
    case "REFUND": // a refund implies it was paid; refunds are out of scope
      return "paid";
    case "PAYERROR":
      return "failed";
    case "CLOSED":
    case "REVOKED":
      return "closed";
    case "NOTPAY":
    case "USERPAYING":
    default:
      return "pending";
  }
}

/** Checks shared by the notify path and the query path. */
function checkMerchant(tx: WechatTransaction): string | null {
  const cfg = wechatPayConfig();
  if (tx.mchid !== cfg.mchId) return "mchid_mismatch";
  if (tx.appid !== cfg.appId) return "appid_mismatch";
  if (tx.amount && tx.amount.currency !== "CNY") return "currency_mismatch";
  return null;
}

export async function applyWechatTransaction(tx: WechatTransaction, source: "notify" | "query", eventId: string, eventType: string): Promise<ApplyResult> {
  const bad = checkMerchant(tx);
  if (bad) {
    log.error("wechatpay.merchant_mismatch", { reason: bad, outTradeNo: tx.out_trade_no });
    return { outcome: "rejected", reason: bad };
  }
  return applyVerifiedEvent({
    provider: "wechat",
    eventId,
    source,
    eventType,
    outTradeNo: tx.out_trade_no,
    target: wechatStateToStatus(tx.trade_state),
    amountFen: tx.amount?.total ?? -1,
    providerTradeNo: tx.transaction_id,
    occurredAt: tx.success_time ? new Date(tx.success_time) : undefined,
    detail: tx.trade_state_desc,
  });
}

export interface HttpReply {
  status: number;
  body: string;
  contentType: string;
}

const ok = (): HttpReply => ({ status: 204, body: "", contentType: "text/plain" });
const failReply = (status: number, message: string): HttpReply => ({
  status,
  body: JSON.stringify({ code: "FAIL", message }),
  contentType: "application/json",
});

/**
 * WeChat Pay notify handler (framework-agnostic, unit-tested).
 *  1. verify Wechatpay-* signature over "timestamp\nnonce\nbody\n" with the platform public key
 *  2. decrypt resource (AEAD_AES_256_GCM, APIv3 key)
 *  3. check mchid / appid / amount / out_trade_no against the stored order
 *  4. apply idempotently, keyed by notification id
 *  5. reply 204 (no body) on success; 4xx/5xx + {"code":"FAIL","message":…} to ask for a retry
 */
export async function handleWechatNotify(rawBody: string, headers: Headers): Promise<HttpReply> {
  const cfg = wechatPayConfig();
  const verified = verifyWechatSignature({
    headers: readSignedHeaders(headers),
    body: rawBody,
    platformPublicKey: cfg.platformPublicKey,
    platformKeyId: cfg.platformKeyId,
  });
  if (!verified.ok) {
    log.warn("wechatpay.notify_rejected", { reason: verified.reason, serial: headers.get("wechatpay-serial") });
    return failReply(401, `signature verification failed: ${verified.reason}`);
  }

  let notification: WechatNotification;
  let tx: WechatTransaction;
  try {
    notification = JSON.parse(rawBody) as WechatNotification;
    tx = JSON.parse(decryptResource(notification.resource, cfg.apiV3Key)) as WechatTransaction;
  } catch (e) {
    log.error("wechatpay.notify_decrypt_failed", { message: (e as Error).message });
    return failReply(400, "cannot decrypt resource");
  }

  if (notification.event_type !== "TRANSACTION.SUCCESS") {
    log.info("wechatpay.notify_ignored", { eventType: notification.event_type, id: notification.id });
    return ok();
  }

  const result = await applyWechatTransaction(tx, "notify", notification.id, notification.event_type);
  log.info("wechatpay.notify_processed", { id: notification.id, outTradeNo: tx.out_trade_no, outcome: result.outcome, reason: result.reason });

  // A signed-but-inconsistent notification will not become consistent on retry:
  // acknowledge it (so it is not retried 15 times) and rely on the audit log + alert.
  return ok();
}
