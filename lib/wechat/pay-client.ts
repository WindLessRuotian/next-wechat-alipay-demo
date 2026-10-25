import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { ProviderError } from "@/lib/payments/errors";
import { toBeijingRfc3339 } from "@/lib/time";
import { buildAuthorization, readSignedHeaders, verifyWechatSignature, type WechatTransaction } from "./pay-crypto";
import { wechatPayConfig, type WechatPayConfig } from "./pay-config";

export interface CreateNativeInput {
  outTradeNo: string;
  description: string;
  amountFen: number;
  timeExpire: Date;
  clientIp: string;
}

/** The three WeChat Pay v3 operations we need. Mock and real implement the same contract. */
export interface WechatPayGateway {
  /** POST /v3/pay/transactions/native → code_url */
  createNative(input: CreateNativeInput): Promise<{ codeUrl: string }>;
  /** GET /v3/pay/transactions/out-trade-no/{out_trade_no}?mchid= ; null when ORDER_NOT_EXIST */
  queryByOutTradeNo(outTradeNo: string): Promise<WechatTransaction | null>;
  /** POST /v3/pay/transactions/out-trade-no/{out_trade_no}/close → 204 */
  close(outTradeNo: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Real HTTP client                                                     */
/* ------------------------------------------------------------------ */

class HttpWechatPayGateway implements WechatPayGateway {
  constructor(private readonly cfg: WechatPayConfig) {}

  private async call<T>(method: "GET" | "POST", pathWithQuery: string, payload?: unknown): Promise<{ status: number; data: T | null }> {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    const authorization = buildAuthorization({
      mchId: this.cfg.mchId,
      serialNo: this.cfg.merchantSerialNo,
      privateKey: this.cfg.merchantPrivateKey,
      method,
      urlPathWithQuery: pathWithQuery,
      body,
    });
    const res = await fetch(this.cfg.baseUrl + pathWithQuery, {
      method,
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "next-wechat-alipay-demo/0.1",
      },
      body: method === "GET" ? undefined : body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();

    if (!res.ok) {
      let code = `HTTP_${res.status}`;
      let message = res.statusText;
      try {
        const err = JSON.parse(text) as { code?: string; message?: string };
        code = err.code ?? code;
        message = err.message ?? message;
      } catch {
        /* non-JSON error body */
      }
      log.warn("wechatpay.api_error", { path: pathWithQuery.split("?")[0], status: res.status, code, message });
      throw new ProviderError("wechat", code, message, res.status);
    }

    // Successful responses are signed by WeChat Pay too — verify before trusting them.
    const verified = verifyWechatSignature({
      headers: readSignedHeaders(res.headers),
      body: text,
      platformPublicKey: this.cfg.platformPublicKey,
      platformKeyId: this.cfg.platformKeyId,
    });
    if (!verified.ok) throw new ProviderError("wechat", "RESPONSE_SIGNATURE_INVALID", verified.reason, res.status);

    return { status: res.status, data: text ? (JSON.parse(text) as T) : null };
  }

  async createNative(input: CreateNativeInput) {
    const { data } = await this.call<{ code_url: string }>("POST", "/v3/pay/transactions/native", {
      appid: this.cfg.appId,
      mchid: this.cfg.mchId,
      description: input.description,
      out_trade_no: input.outTradeNo,
      time_expire: toBeijingRfc3339(input.timeExpire),
      notify_url: this.cfg.notifyUrl,
      amount: { total: input.amountFen, currency: "CNY" },
      scene_info: { payer_client_ip: input.clientIp },
    });
    if (!data?.code_url) throw new ProviderError("wechat", "NO_CODE_URL", "code_url missing in response");
    return { codeUrl: data.code_url };
  }

  async queryByOutTradeNo(outTradeNo: string) {
    try {
      const { data } = await this.call<WechatTransaction>(
        "GET",
        `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(this.cfg.mchId)}`,
      );
      return data;
    } catch (e) {
      if (e instanceof ProviderError && e.code === "ORDER_NOT_EXIST") return null;
      throw e;
    }
  }

  async close(outTradeNo: string) {
    await this.call("POST", `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`, { mchid: this.cfg.mchId });
  }
}

/* ------------------------------------------------------------------ */
/* Mock gateway — behaves like the provider, state kept in mock_trades  */
/* ------------------------------------------------------------------ */

class MockWechatPayGateway implements WechatPayGateway {
  constructor(private readonly cfg: WechatPayConfig) {}

  async createNative(input: CreateNativeInput) {
    await (await db())
      .insert(schema.mockTrades)
      .values({
        outTradeNo: input.outTradeNo,
        provider: "wechat",
        amountFen: input.amountFen,
        state: "NOTPAY",
        tradeNo: `4200${Date.now()}${crypto.randomInt(1e5, 1e6 - 1)}`,
      })
      .run();
    return { codeUrl: `weixin://wxpay/bizpayurl?pr=MOCK${crypto.randomBytes(5).toString("hex")}` };
  }

  async queryByOutTradeNo(outTradeNo: string): Promise<WechatTransaction | null> {
    const t = await (await db()).select().from(schema.mockTrades).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).get();
    if (!t) return null;
    return mockTransaction(this.cfg, t);
  }

  async close(outTradeNo: string) {
    const t = await (await db()).select().from(schema.mockTrades).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).get();
    if (!t) throw new ProviderError("wechat", "ORDER_NOT_EXIST", "mock: order not found", 404);
    if (t.state === "SUCCESS") throw new ProviderError("wechat", "ORDERPAID", "mock: order already paid", 400);
    await (await db()).update(schema.mockTrades).set({ state: "CLOSED", updatedAt: new Date() }).where(eq(schema.mockTrades.outTradeNo, outTradeNo)).run();
  }
}

export function mockTransaction(cfg: Pick<WechatPayConfig, "appId" | "mchId">, t: typeof schema.mockTrades.$inferSelect): WechatTransaction {
  const state = t.state as WechatTransaction["trade_state"];
  return {
    appid: cfg.appId,
    mchid: cfg.mchId,
    out_trade_no: t.outTradeNo,
    transaction_id: state === "SUCCESS" ? t.tradeNo : undefined,
    trade_state: state,
    trade_state_desc: state,
    success_time: state === "SUCCESS" ? toBeijingRfc3339(t.updatedAt) : undefined,
    amount: { total: t.amountFen, payer_total: t.amountFen, currency: "CNY", payer_currency: "CNY" },
  };
}

let gateway: WechatPayGateway | undefined;

export function wechatPay(): WechatPayGateway {
  if (!gateway) {
    const cfg = wechatPayConfig();
    gateway = cfg.mode === "mock" ? new MockWechatPayGateway(cfg) : new HttpWechatPayGateway(cfg);
  }
  return gateway;
}
