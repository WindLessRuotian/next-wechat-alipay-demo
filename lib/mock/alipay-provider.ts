import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadPrivateKey, loadPublicKey, rsaSha256Verify } from "@/lib/crypto";
import { fenToYuan, yuanToFen } from "@/lib/money";
import { toBeijingDateTime } from "@/lib/time";
import { requestSignContent, signNotifyAsAlipay, signResponseAsAlipay, type Params } from "@/lib/alipay/sign";
import { mockKeys } from "./keys";
import { consumeMockCode, mockProfileByCode } from "./oauth";

/**
 * A tiny in-process stand-in for the Alipay OpenAPI gateway. It verifies the
 * merchant's request signature with the app public key and answers with a
 * response signed by the mock "Alipay" private key — so the real client code
 * (signing, response verification, error mapping) runs unchanged in mock mode.
 */

const MOCK_APP_ID = "9021000000000000";
const MOCK_SELLER_ID = "2088000000000000";

const platformKey = () => loadPrivateKey(mockKeys().alipayPlatform.privateKey);
const appPublicKey = () => loadPublicKey(mockKeys().alipayApp.publicKey);

export function verifyMerchantRequest(params: Params): boolean {
  return !!params.sign && rsaSha256Verify(appPublicKey(), requestSignContent(params), params.sign);
}

const fail = (sub_code: string, sub_msg: string) => ({ code: "40004", msg: "Business Failed", sub_code, sub_msg });

async function trade(outTradeNo: string) {
  return (await db()).select().from(schema.mockTrades).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).get();
}

export const mockAlipayTransport = async (_gateway: string, params: Params): Promise<string> => {
  const method = params.method ?? "";
  if (!verifyMerchantRequest(params)) {
    return signResponseAsAlipay(method, { code: "40002", msg: "Invalid Arguments", sub_code: "isv.invalid-signature", sub_msg: "mock: bad merchant signature" }, platformKey());
  }
  const biz = params.biz_content ? (JSON.parse(params.biz_content) as Record<string, string>) : {};
  let node: Record<string, unknown>;

  switch (method) {
    case "alipay.trade.query": {
      const t = await trade(biz.out_trade_no ?? "");
      node = t
        ? { code: "10000", msg: "Success", out_trade_no: t.outTradeNo, trade_no: t.tradeNo, trade_status: t.state, total_amount: fenToYuan(t.amountFen) }
        : fail("ACQ.TRADE_NOT_EXIST", "交易不存在");
      break;
    }
    case "alipay.trade.close": {
      const t = await trade(biz.out_trade_no ?? "");
      if (!t) node = fail("ACQ.TRADE_NOT_EXIST", "交易不存在");
      else if (t.state !== "WAIT_BUYER_PAY") node = fail("ACQ.TRADE_STATUS_ERROR", "交易状态不合法");
      else {
        await (await db()).update(schema.mockTrades).set({ state: "TRADE_CLOSED", updatedAt: new Date() }).where(eq(schema.mockTrades.outTradeNo, t.outTradeNo)).run();
        node = { code: "10000", msg: "Success", out_trade_no: t.outTradeNo, trade_no: t.tradeNo };
      }
      break;
    }
    case "alipay.system.oauth.token": {
      const profile = await consumeMockCode("alipay", params.code ?? "");
      if (!profile) {
        // Real Alipay reports OAuth failures in an `error_response` node.
        return signResponseAsAlipay(
          method,
          { code: "40002", msg: "Invalid Arguments", sub_code: "isv.code-invalid", sub_msg: "授权码code无效" },
          platformKey(),
          "error_response",
        );
      }
      node = { access_token: `mockat_${params.code}`, open_id: profile.providerUserId, expires_in: 1296000 };
      break;
    }
    case "alipay.user.info.share": {
      const code = (params.auth_token ?? "").replace(/^mockat_/, "");
      const profile = await mockProfileByCode("alipay", code);
      node = profile
        ? { code: "10000", msg: "Success", open_id: profile.providerUserId, nick_name: profile.nickname, avatar: profile.avatarUrl }
        : { code: "20001", msg: "Invalid Auth Token", sub_code: "aop.invalid-auth-token", sub_msg: "无效的访问令牌" };
      break;
    }
    default:
      node = { code: "40004", msg: "Business Failed", sub_code: "mock.unsupported-method", sub_msg: method };
  }
  return signResponseAsAlipay(method, node, platformKey());
};

/** Called when the browser lands on the mock cashier: the trade now "exists" at Alipay. */
export async function openMockCashier(
  params: Params,
): Promise<{ ok: true; outTradeNo: string; amountFen: number; subject: string } | { ok: false; error: string }> {
  if (params.app_id !== MOCK_APP_ID) return { ok: false, error: "unknown app_id" };
  if (!verifyMerchantRequest(params)) return { ok: false, error: "invalid merchant signature (isv.invalid-signature)" };
  const biz = JSON.parse(params.biz_content ?? "{}") as Record<string, string>;
  const amountFen = yuanToFen(biz.total_amount ?? "");
  if (!biz.out_trade_no || amountFen === null) return { ok: false, error: "invalid biz_content" };
  await (await db())
    .insert(schema.mockTrades)
    .values({ outTradeNo: biz.out_trade_no, provider: "alipay", amountFen, state: "WAIT_BUYER_PAY", tradeNo: `2026${Date.now()}${crypto.randomInt(1e5, 1e6 - 1)}` })
    .onConflictDoNothing()
    .run();
  return { ok: true, outTradeNo: biz.out_trade_no, amountFen, subject: biz.subject ?? "" };
}

/** Advance the mock trade and build the asynchronous notification Alipay would POST. */
export async function buildMockAlipayNotify(outTradeNo: string, status: "TRADE_SUCCESS" | "TRADE_CLOSED"): Promise<Params | null> {
  const t = await trade(outTradeNo);
  if (!t) return null;
  if (t.state === "WAIT_BUYER_PAY") {
    await (await db()).update(schema.mockTrades).set({ state: status, updatedAt: new Date() }).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).run();
  }
  const now = toBeijingDateTime(new Date());
  const params: Params = {
    notify_time: now,
    notify_type: "trade_status_sync",
    notify_id: crypto.randomBytes(16).toString("hex"),
    charset: "utf-8",
    version: "1.0",
    auth_app_id: MOCK_APP_ID,
    app_id: MOCK_APP_ID,
    seller_id: MOCK_SELLER_ID,
    trade_no: t.tradeNo,
    out_trade_no: t.outTradeNo,
    trade_status: status,
    total_amount: fenToYuan(t.amountFen),
    receipt_amount: fenToYuan(t.amountFen),
    buyer_pay_amount: fenToYuan(t.amountFen),
    subject: "Test item (integration demo)",
    gmt_create: now,
    ...(status === "TRADE_SUCCESS" ? { gmt_payment: now } : { gmt_close: now }),
  };
  return signNotifyAsAlipay(params, platformKey());
}
