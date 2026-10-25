import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { buildMockAlipayNotify } from "@/lib/mock/alipay-provider";
import { buildMockWechatSuccessNotify, failMockWechatTrade } from "@/lib/mock/wechat-provider";
import { handleAlipayNotify } from "@/lib/payments/alipay";
import { applyVerifiedEvent } from "@/lib/payments/orders";
import { closeOrder, refreshOrder } from "@/lib/payments/sync";
import { handleWechatNotify } from "@/lib/payments/wechat";
import { wechatPay } from "@/lib/wechat/pay-client";
import { eventsFor, makeOrder, mockTrade, reload, setMockTrade } from "./helpers";

async function wechatOrder() {
  const order = await makeOrder("wechat");
  await wechatPay().createNative({ outTradeNo: order.outTradeNo, description: order.subject, amountFen: order.amountFen, timeExpire: order.expiresAt, clientIp: "127.0.0.1" });
  return order;
}

async function alipayOrder() {
  const order = await makeOrder("alipay");
  await (await db())
    .insert(schema.mockTrades)
    .values({ outTradeNo: order.outTradeNo, provider: "alipay", amountFen: order.amountFen, state: "WAIT_BUYER_PAY", tradeNo: "2026T" + order.outTradeNo })
    .run();
  return order;
}

async function wechatNotify(outTradeNo: string) {
  const n = await buildMockWechatSuccessNotify(outTradeNo);
  if (!n) throw new Error("no mock trade");
  return n;
}

describe("WeChat Pay notify handler", () => {
  it("marks the order paid and replies 204 with no body", async () => {
    const order = await wechatOrder();
    const n = await wechatNotify(order.outTradeNo);
    expect(await handleWechatNotify(n.body, new Headers(n.headers))).toMatchObject({ status: 204, body: "" });
    const o = await reload(order.id);
    expect(o.status).toBe("paid");
    expect(o.providerTradeNo).toBeTruthy();
  });

  it("is idempotent: the same notification twice updates once", async () => {
    const order = await wechatOrder();
    const n = await wechatNotify(order.outTradeNo);
    expect((await handleWechatNotify(n.body, new Headers(n.headers))).status).toBe(204);
    const first = await reload(order.id);
    expect((await handleWechatNotify(n.body, new Headers(n.headers))).status).toBe(204); // still ACKed
    const second = await reload(order.id);
    expect(second.status).toBe("paid");
    expect(second.paidAt?.getTime()).toBe(first.paidAt?.getTime());
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
    const evs = await eventsFor(order.outTradeNo);
    expect(evs).toHaveLength(1);
    expect(evs[0]!.outcome).toBe("applied");
  });

  it("concurrent deliveries of the same notification apply exactly once", async () => {
    const order = await wechatOrder();
    const n = await wechatNotify(order.outTradeNo);
    const replies = await Promise.all(Array.from({ length: 5 }, () => handleWechatNotify(n.body, new Headers(n.headers))));
    expect(replies.every((r) => r.status === 204)).toBe(true);
    expect(await eventsFor(order.outTradeNo)).toHaveLength(1);
    expect((await reload(order.id)).status).toBe("paid");
  });

  it("a different notification for an already-paid order is recorded but does not re-apply", async () => {
    const order = await wechatOrder();
    const a = await wechatNotify(order.outTradeNo);
    const b = await wechatNotify(order.outTradeNo); // new notification id
    await handleWechatNotify(a.body, new Headers(a.headers));
    const paidAt = (await reload(order.id)).paidAt;
    await handleWechatNotify(b.body, new Headers(b.headers));
    expect((await reload(order.id)).paidAt).toEqual(paidAt);
    expect((await eventsFor(order.outTradeNo)).map((e) => e.outcome).sort()).toEqual(["applied", "ignored"]);
  });

  it("rejects a bad signature with 401 + FAIL body and leaves the order pending", async () => {
    const order = await wechatOrder();
    const n = await wechatNotify(order.outTradeNo);
    const tampered = n.body.replace('"TRANSACTION.SUCCESS"', '"TRANSACTION.SUCCESS" ');
    const reply = await handleWechatNotify(tampered, new Headers(n.headers));
    expect(reply.status).toBe(401);
    expect(JSON.parse(reply.body)).toMatchObject({ code: "FAIL" });
    expect((await reload(order.id)).status).toBe("pending");
    expect(await eventsFor(order.outTradeNo)).toHaveLength(0);
  });

  it("does not mark paid when the (validly signed) amount differs from the stored order", async () => {
    const order = await wechatOrder();
    await setMockTrade(order.outTradeNo, { amountFen: 100 }); // provider says 1.00 CNY, we sold 0.01
    const n = await wechatNotify(order.outTradeNo);
    expect((await handleWechatNotify(n.body, new Headers(n.headers))).status).toBe(204);
    expect((await reload(order.id)).status).toBe("pending");
    expect((await eventsFor(order.outTradeNo))[0]).toMatchObject({ outcome: "rejected" });
  });
});

describe("Alipay notify handler", () => {
  const body = async (outTradeNo: string, status: "TRADE_SUCCESS" | "TRADE_CLOSED" = "TRADE_SUCCESS") =>
    new URLSearchParams((await buildMockAlipayNotify(outTradeNo, status))!).toString();

  it("marks paid and replies the plain text 'success'", async () => {
    const order = await alipayOrder();
    expect(await handleAlipayNotify(await body(order.outTradeNo))).toMatchObject({ status: 200, body: "success" });
    expect((await reload(order.id)).status).toBe("paid");
  });

  it("is idempotent on notify_id", async () => {
    const order = await alipayOrder();
    const b = await body(order.outTradeNo);
    await handleAlipayNotify(b);
    const first = await reload(order.id);
    expect((await handleAlipayNotify(b)).body).toBe("success");
    expect((await reload(order.id)).updatedAt).toEqual(first.updatedAt);
    expect(await eventsFor(order.outTradeNo)).toHaveLength(1);
  });

  it("replies 'fail' for a forged signature and changes nothing", async () => {
    const order = await alipayOrder();
    const forged = (await body(order.outTradeNo)).replace("total_amount=0.01", "total_amount=0.02");
    expect((await handleAlipayNotify(forged)).body).toBe("fail");
    expect((await reload(order.id)).status).toBe("pending");
  });

  it("rejects an amount mismatch even with a valid signature", async () => {
    const order = await alipayOrder();
    await setMockTrade(order.outTradeNo, { amountFen: 999 });
    expect((await handleAlipayNotify(await body(order.outTradeNo))).body).toBe("success");
    expect((await reload(order.id)).status).toBe("pending");
  });

  it("TRADE_CLOSED closes a pending order", async () => {
    const order = await alipayOrder();
    await handleAlipayNotify(await body(order.outTradeNo, "TRADE_CLOSED"));
    expect((await reload(order.id)).status).toBe("closed");
  });
});

describe("state machine", () => {
  it("never leaves a terminal state", async () => {
    const order = await makeOrder("alipay");
    const base = { provider: "alipay" as const, source: "query" as const, eventType: "T", outTradeNo: order.outTradeNo, amountFen: order.amountFen };
    expect((await applyVerifiedEvent({ ...base, eventId: "e1", target: "closed" })).outcome).toBe("applied");
    expect((await applyVerifiedEvent({ ...base, eventId: "e2", target: "paid" })).outcome).toBe("ignored");
    expect((await reload(order.id)).status).toBe("closed");
  });
  it("rejects events for unknown orders", async () => {
    const r = await applyVerifiedEvent({ provider: "wechat", source: "notify", eventType: "T", outTradeNo: "NOPE", amountFen: 1, eventId: "x", target: "paid" });
    expect(r).toMatchObject({ outcome: "rejected", reason: "unknown_order" });
  });
});

describe("query fallback and expiry", () => {
  it("picks up a payment whose notification was lost", async () => {
    const order = await wechatOrder();
    await wechatNotify(order.outTradeNo); // provider is paid; we never deliver the notify
    const o = await refreshOrder(order, { force: true });
    expect(o.status).toBe("paid");
    expect((await eventsFor(order.outTradeNo))[0]).toMatchObject({ source: "query", outcome: "applied" });
  });

  it("maps WeChat PAYERROR to failed", async () => {
    const order = await wechatOrder();
    await failMockWechatTrade(order.outTradeNo);
    expect((await refreshOrder(order, { force: true })).status).toBe("failed");
  });

  it("closes expired unpaid orders at the provider and locally", async () => {
    const order = await wechatOrder();
    await (await db()).update(schema.orders).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.orders.id, order.id)).run();
    const o = await refreshOrder(await reload(order.id));
    expect(o.status).toBe("closed");
    expect((await mockTrade(order.outTradeNo)).state).toBe("CLOSED");
  });

  it("a payment that lands before close wins over the close", async () => {
    const order = await alipayOrder();
    await setMockTrade(order.outTradeNo, { state: "TRADE_SUCCESS" });
    const o = await closeOrder(order, "cancelled_by_user");
    expect(o?.status).toBe("paid");
  });
});
