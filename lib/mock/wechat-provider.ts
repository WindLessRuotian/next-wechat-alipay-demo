import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadPrivateKey } from "@/lib/crypto";
import { wechatPayConfig } from "@/lib/wechat/pay-config";
import { mockTransaction } from "@/lib/wechat/pay-client";
import { encryptResource, signAsPlatform, type WechatNotification } from "@/lib/wechat/pay-crypto";
import { mockKeys } from "./keys";

export interface SignedHttpRequest {
  body: string;
  headers: Record<string, string>;
}

/**
 * Mark the mock trade as paid and build the exact TRANSACTION.SUCCESS
 * notification WeChat Pay would POST: resource encrypted with the APIv3 key,
 * envelope signed with the (mock) WeChat Pay platform private key.
 */
export async function buildMockWechatSuccessNotify(outTradeNo: string): Promise<SignedHttpRequest | null> {
  const cfg = wechatPayConfig();
  const d = await db();
  const t = await d.select().from(schema.mockTrades).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).get();
  if (!t) return null;
  if (t.state === "NOTPAY") {
    await d.update(schema.mockTrades).set({ state: "SUCCESS", updatedAt: new Date() }).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).run();
  }
  const fresh = (await d.select().from(schema.mockTrades).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).get())!;
  if (fresh.state !== "SUCCESS") return null;

  const tx = { ...mockTransaction(cfg, fresh), trade_type: "NATIVE", payer: { openid: "oMOCKpayer000000000000000000" } };
  const notification: WechatNotification = {
    id: crypto.randomUUID(),
    create_time: new Date().toISOString(),
    resource_type: "encrypt-resource",
    event_type: "TRANSACTION.SUCCESS",
    summary: "支付成功",
    resource: encryptResource(JSON.stringify(tx), cfg.apiV3Key),
  };
  const body = JSON.stringify(notification);
  const headers = signAsPlatform(body, loadPrivateKey(mockKeys().wechatPlatform.privateKey), cfg.platformKeyId);
  return { body, headers: { ...headers, "Content-Type": "application/json" } };
}

/** The payer's bank declined: WeChat sends no notification; only a query reveals PAYERROR. */
export async function failMockWechatTrade(outTradeNo: string): Promise<boolean> {
  const res = await (await db())
    .update(schema.mockTrades)
    .set({ state: "PAYERROR", updatedAt: new Date() })
    .where(eq(schema.mockTrades.outTradeNo, outTradeNo))
    .returning()
    .get();
  return !!res;
}
