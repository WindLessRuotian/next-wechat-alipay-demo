import "server-only";
import type { Order } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { yuanToFen } from "@/lib/money";
import { fromBeijingDateTime } from "@/lib/time";
import { alipay } from "@/lib/alipay/client";
import { wechatPay } from "@/lib/wechat/pay-client";
import { ProviderError } from "./errors";
import { alipayStateToStatus } from "./alipay";
import { applyVerifiedEvent, getOrder, markClosedLocally, touchQueried } from "./orders";
import { applyWechatTransaction } from "./wechat";

/** Minimum gap between active queries for the same order (the page polls every 2s). */
const QUERY_INTERVAL_MS = 5_000;
/** Don't start querying until the user has had a moment to pay. */
const QUERY_GRACE_MS = 3_000;

/**
 * Fallback for missed notifications ("主动查询"): ask the provider for the
 * truth, then run it through the same idempotent state machine as notify.
 */
export async function queryAndApply(order: Order): Promise<void> {
  if (order.provider === "wechat") {
    const tx = await wechatPay().queryByOutTradeNo(order.outTradeNo);
    if (!tx) return;
    await applyWechatTransaction(tx, "query", `query:${order.outTradeNo}:${tx.trade_state}`, `QUERY.${tx.trade_state}`);
  } else {
    const client = await alipay();
    const q = await client.query(order.outTradeNo);
    if (!q?.trade_status || q.out_trade_no !== order.outTradeNo) return;
    await applyVerifiedEvent({
      provider: "alipay",
      eventId: `query:${order.outTradeNo}:${q.trade_status}`,
      source: "query",
      eventType: `QUERY.${q.trade_status}`,
      outTradeNo: order.outTradeNo,
      target: alipayStateToStatus(q.trade_status),
      amountFen: yuanToFen(q.total_amount ?? "") ?? -1,
      providerTradeNo: q.trade_no,
      occurredAt: fromBeijingDateTime(q.send_pay_date ?? "") ?? undefined,
    });
  }
}

/**
 * Close at the provider first, then locally. If the provider says the order
 * was already paid, re-query instead of closing (the payment wins).
 */
export async function closeOrder(order: Order, reason: string): Promise<Order | undefined> {
  if (order.status !== "pending") return order;
  try {
    if (order.provider === "wechat") await wechatPay().close(order.outTradeNo);
    else await (await alipay()).close(order.outTradeNo);
  } catch (e) {
    if (e instanceof ProviderError && (e.code === "ORDERPAID" || e.code === "ACQ.TRADE_STATUS_ERROR")) {
      await queryAndApply(order);
      return await getOrder(order.id);
    }
    if (!(e instanceof ProviderError && (e.code === "ORDER_NOT_EXIST" || e.code === "ORDERCLOSED"))) throw e;
  }
  // Paranoia: a payment may have landed between our last query and the close call.
  await queryAndApply(order).catch((e: unknown) => log.warn("order.close_requery_failed", { orderId: order.id, message: (e as Error).message }));
  const fresh = await getOrder(order.id);
  if (fresh?.status !== "pending") return fresh;
  return (await markClosedLocally(order.id, reason)) ?? (await getOrder(order.id));
}

/**
 * Called whenever an order is read: expire it if its TTL passed, otherwise
 * (rate-limited) query the provider in case the notification was missed.
 */
export async function refreshOrder(order: Order, opts: { force?: boolean } = {}): Promise<Order> {
  if (order.status !== "pending") return order;
  const now = Date.now();
  try {
    if (now >= order.expiresAt.getTime()) {
      return (await closeOrder(order, "expired")) ?? order;
    }
    const due =
      opts.force ||
      (now - order.createdAt.getTime() > QUERY_GRACE_MS && (!order.lastQueriedAt || now - order.lastQueriedAt.getTime() > QUERY_INTERVAL_MS));
    if (due) {
      await touchQueried(order.id);
      await queryAndApply(order);
    }
  } catch (e) {
    // Provider outage must not break the page; the notify path still works.
    log.warn("order.refresh_failed", { orderId: order.id, message: e instanceof Error ? e.message : String(e) });
  }
  return (await getOrder(order.id)) ?? order;
}
