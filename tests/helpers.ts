import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createOrder } from "@/lib/payments/orders";
import type { Provider } from "@/lib/db/schema";

export async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await (await db()).insert(schema.users).values({ id, name: "tester" }).run();
  return id;
}

export async function makeOrder(provider: Provider) {
  return createOrder(await makeUser(), provider);
}

export const reload = async (orderId: string) => (await (await db()).select().from(schema.orders).where(eq(schema.orders.id, orderId)).get())!;

export const eventsFor = async (outTradeNo: string) =>
  (await db()).select().from(schema.paymentEvents).where(eq(schema.paymentEvents.outTradeNo, outTradeNo)).all();

export const mockTrade = async (outTradeNo: string) =>
  (await (await db()).select().from(schema.mockTrades).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).get())!;

export async function setMockTrade(outTradeNo: string, patch: { amountFen?: number; state?: string }) {
  await (await db()).update(schema.mockTrades).set(patch).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).run();
}

export function keyPair() {
  return crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
}
