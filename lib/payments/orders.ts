import "server-only";
import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema, withWriteTransaction } from "@/lib/db";
import type { Order, OrderStatus, Provider } from "@/lib/db/schema";
import { newOutTradeNo } from "@/lib/crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { TEST_ITEM } from "@/lib/catalog";

/**
 * Order state machine. The ONLY transitions are
 *     pending → paid | failed | closed
 * and every one is a conditional UPDATE … WHERE status = 'pending', so
 * concurrent or repeated provider events can never double-apply.
 */

export async function createOrder(userId: string, provider: Provider): Promise<Order> {
  const now = new Date();
  const ttlMs = env().ORDER_TTL_MINUTES * 60_000;
  return (await db())
    .insert(schema.orders)
    .values({
      id: crypto.randomUUID(),
      outTradeNo: newOutTradeNo(now),
      userId,
      provider,
      subject: TEST_ITEM.subject,
      amountFen: TEST_ITEM.amountFen,
      currency: TEST_ITEM.currency,
      status: "pending",
      expiresAt: new Date(now.getTime() + ttlMs),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export async function getOrderForUser(orderId: string, userId: string): Promise<Order | undefined> {
  return (await db())
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)))
    .get();
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  return (await db()).select().from(schema.orders).where(eq(schema.orders.userId, userId)).orderBy(desc(schema.orders.createdAt)).all();
}

export async function getOrderByOutTradeNo(provider: Provider, outTradeNo: string): Promise<Order | undefined> {
  return (await db())
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.provider, provider), eq(schema.orders.outTradeNo, outTradeNo)))
    .get();
}

export async function setCodeUrl(orderId: string, codeUrl: string): Promise<void> {
  await (await db()).update(schema.orders).set({ codeUrl, updatedAt: new Date() }).where(eq(schema.orders.id, orderId)).run();
}

export async function markFailedToCreate(orderId: string, reason: string): Promise<void> {
  await (await db())
    .update(schema.orders)
    .set({ status: "failed", failureReason: reason.slice(0, 200), updatedAt: new Date() })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")))
    .run();
}

/** A provider-side fact about a trade that has ALREADY passed signature verification. */
export interface VerifiedProviderEvent {
  provider: Provider;
  /** Idempotency key, e.g. WeChat notification `id`, Alipay `notify_id`, or a synthetic query key. */
  eventId: string;
  source: "notify" | "query";
  eventType: string;
  outTradeNo: string;
  /** Normalised target state. */
  target: OrderStatus;
  /** Amount as reported by the provider, in fen. */
  amountFen: number;
  /** Merchant identity reported by the provider (appid/mchid or app_id/seller_id) already checked by caller. */
  providerTradeNo?: string;
  occurredAt?: Date;
  detail?: string;
}

export type ApplyOutcome =
  | "applied" // state changed
  | "duplicate" // same event already processed
  | "ignored" // valid but nothing to do (e.g. still pending, or order already terminal)
  | "rejected"; // valid signature but inconsistent with our order (unknown order / amount mismatch)

export interface ApplyResult {
  outcome: ApplyOutcome;
  reason?: string;
  order?: Order;
}

export async function applyVerifiedEvent(ev: VerifiedProviderEvent): Promise<ApplyResult> {
  return withWriteTransaction(async (tx): Promise<ApplyResult> => {
    const record = async (outcome: ApplyOutcome, detail?: string) =>
      (
        await tx
        .insert(schema.paymentEvents)
        .values({
          provider: ev.provider,
          eventId: ev.eventId,
          source: ev.source,
          outTradeNo: ev.outTradeNo,
          eventType: ev.eventType,
          outcome,
          detail: detail ?? ev.detail ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: schema.paymentEvents.id })
          .all()
      ).length > 0;

    const order = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.provider, ev.provider), eq(schema.orders.outTradeNo, ev.outTradeNo)))
      .get();

    if (!order) {
      await record("rejected", "unknown_order");
      return { outcome: "rejected", reason: "unknown_order" };
    }
    if (ev.amountFen !== order.amountFen) {
      await record("rejected", `amount_mismatch expected=${order.amountFen} got=${ev.amountFen}`);
      return { outcome: "rejected", reason: "amount_mismatch", order };
    }

    // Idempotency gate: the first writer of (provider, eventId) wins.
    if (ev.target === "pending") {
      return { outcome: "ignored", reason: "still_pending", order };
    }
    if (!(await record("applied"))) {
      return { outcome: "duplicate", order };
    }

    const now = new Date();
    const patch: Partial<Order> = { status: ev.target, updatedAt: now };
    if (ev.target === "paid") {
      patch.paidAt = ev.occurredAt ?? now;
      patch.providerTradeNo = ev.providerTradeNo ?? null;
    }
    if (ev.target === "closed") patch.closedAt = ev.occurredAt ?? now;
    if (ev.target === "failed") patch.failureReason = ev.detail ?? "provider reported failure";

    const updated = await tx
      .update(schema.orders)
      .set(patch)
      .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, "pending")))
      .returning()
      .get();

    if (!updated) {
      // Event is new but the order is already terminal (e.g. query saw it first).
      await tx
        .update(schema.paymentEvents)
        .set({ outcome: "ignored", detail: `order already ${order.status}` })
        .where(and(eq(schema.paymentEvents.provider, ev.provider), eq(schema.paymentEvents.eventId, ev.eventId)))
        .run();
      if (order.status !== ev.target) {
        // e.g. "paid" arriving for a locally "closed" order — needs a human (refund) in real life.
        log.error("order.state_conflict", { orderId: order.id, current: order.status, incoming: ev.target, eventId: ev.eventId });
      }
      return { outcome: "ignored", reason: `already_${order.status}`, order };
    }

    log.info("order.transition", { orderId: order.id, from: "pending", to: ev.target, source: ev.source, eventId: ev.eventId });
    return { outcome: "applied", order: updated };
  });
}

/** Conditional local close (after the provider-side close succeeded). */
export async function markClosedLocally(orderId: string, reason: string): Promise<Order | undefined> {
  const now = new Date();
  return (await db())
    .update(schema.orders)
    .set({ status: "closed", closedAt: now, failureReason: reason, updatedAt: now })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")))
    .returning()
    .get();
}

export async function touchQueried(orderId: string): Promise<void> {
  await (await db()).update(schema.orders).set({ lastQueriedAt: new Date() }).where(eq(schema.orders.id, orderId)).run();
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  return (await db()).select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
}
