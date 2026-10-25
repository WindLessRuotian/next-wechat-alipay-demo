import "server-only";
import { log } from "@/lib/log";
import { ProviderError } from "@/lib/payments/errors";
import { fenToYuan } from "@/lib/money";
import { toBeijingDateTime } from "@/lib/time";
import { alipayConfig, type AlipayConfig } from "./config";
import { signRequest, verifyResponse, type Params } from "./sign";

/** Sends a signed OpenAPI request and returns the raw response body. */
export type AlipayTransport = (gateway: string, params: Params) => Promise<string>;

const httpTransport: AlipayTransport = async (gateway, params) => {
  const res = await fetch(gateway, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new ProviderError("alipay", `HTTP_${res.status}`, res.statusText, res.status);
  return res.text();
};

export interface PayPageInput {
  outTradeNo: string;
  subject: string;
  amountFen: number;
  timeExpire: Date;
}

export interface AlipayTradeQuery {
  code: string;
  msg: string;
  sub_code?: string;
  sub_msg?: string;
  out_trade_no?: string;
  trade_no?: string;
  trade_status?: "WAIT_BUYER_PAY" | "TRADE_CLOSED" | "TRADE_SUCCESS" | "TRADE_FINISHED";
  total_amount?: string;
  send_pay_date?: string;
}

interface OauthTokenNode {
  access_token?: string;
  user_id?: string;
  open_id?: string;
  union_id?: string;
  expires_in?: number | string;
  code?: string;
  msg?: string;
  sub_code?: string;
  sub_msg?: string;
}

interface UserInfoNode {
  code: string;
  msg: string;
  sub_code?: string;
  sub_msg?: string;
  user_id?: string;
  open_id?: string;
  union_id?: string;
  nick_name?: string;
  avatar?: string;
}

export class AlipayClient {
  constructor(
    private readonly cfg: AlipayConfig,
    private readonly transport: AlipayTransport = httpTransport,
  ) {}

  private commonParams(method: string, extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return {
      app_id: this.cfg.appId,
      method,
      format: "JSON",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: toBeijingDateTime(new Date()),
      version: "1.0",
      ...extra,
    };
  }

  /** Generic OpenAPI call: sign → send → verify response signature → check business code. */
  async exec<T extends { code?: string; msg?: string; sub_code?: string; sub_msg?: string }>(
    method: string,
    opts: { bizContent?: object; params?: Record<string, string | undefined> } = {},
  ): Promise<T> {
    const signed = signRequest(
      this.commonParams(method, { ...opts.params, biz_content: opts.bizContent ? JSON.stringify(opts.bizContent) : undefined }),
      this.cfg.appPrivateKey,
    );
    // Method and latency only: never parameters, codes or tokens.
    const started = Date.now();
    let raw: string;
    try {
      raw = await this.transport(this.cfg.gateway, signed);
    } catch (e) {
      log.warn("alipay.transport_failed", { method, ms: Date.now() - started, message: e instanceof Error ? e.message : String(e) });
      throw e;
    }
    log.info("alipay.api_call", { method, ms: Date.now() - started });
    const v = verifyResponse<T>(raw, method, this.cfg.alipayPublicKey);
    if (!v.ok) {
      // An unsigned error_response (e.g. invalid app_id) still tells us *why* it failed.
      const n = v.node;
      log.warn("alipay.response_unverified", { method, reason: v.reason, code: n?.code, sub_code: n?.sub_code });
      throw new ProviderError("alipay", n?.sub_code ?? n?.code ?? "RESPONSE_SIGNATURE_INVALID", n?.sub_msg ?? n?.msg ?? v.reason);
    }
    const node = v.node;
    if (v.nodeName === "error_response" || (node.code !== undefined && node.code !== "10000")) {
      log.warn("alipay.api_error", { method, code: node.code, sub_code: node.sub_code, sub_msg: node.sub_msg });
      throw new ProviderError("alipay", node.sub_code ?? node.code ?? "UNKNOWN", node.sub_msg ?? node.msg ?? "unknown error");
    }
    return node;
  }

  /** Build a signed URL to the cashier; the browser is redirected there (GET form of pageExecute). */
  private payUrl(method: "alipay.trade.page.pay" | "alipay.trade.wap.pay", productCode: string, input: PayPageInput): string {
    const signed = signRequest(
      this.commonParams(method, {
        notify_url: this.cfg.notifyUrl,
        return_url: this.cfg.returnUrl,
        biz_content: JSON.stringify({
          out_trade_no: input.outTradeNo,
          total_amount: fenToYuan(input.amountFen),
          subject: input.subject,
          product_code: productCode,
          time_expire: toBeijingDateTime(input.timeExpire),
        }),
      }),
      this.cfg.appPrivateKey,
    );
    return `${this.cfg.gateway}?${new URLSearchParams(signed).toString()}`;
  }

  /** PC website payment — alipay.trade.page.pay, product_code FAST_INSTANT_TRADE_PAY */
  pagePayUrl(input: PayPageInput): string {
    return this.payUrl("alipay.trade.page.pay", "FAST_INSTANT_TRADE_PAY", input);
  }

  /** Mobile website payment (bonus) — alipay.trade.wap.pay, product_code QUICK_WAP_WAY */
  wapPayUrl(input: PayPageInput): string {
    return this.payUrl("alipay.trade.wap.pay", "QUICK_WAP_WAY", input);
  }

  /** alipay.trade.query; null when the trade does not exist yet (buyer never opened the cashier). */
  async query(outTradeNo: string): Promise<AlipayTradeQuery | null> {
    try {
      return await this.exec<AlipayTradeQuery>("alipay.trade.query", { bizContent: { out_trade_no: outTradeNo } });
    } catch (e) {
      if (e instanceof ProviderError && e.code === "ACQ.TRADE_NOT_EXIST") return null;
      throw e;
    }
  }

  /** alipay.trade.close; a not-yet-created trade is treated as already closed. */
  async close(outTradeNo: string): Promise<void> {
    try {
      await this.exec("alipay.trade.close", { bizContent: { out_trade_no: outTradeNo } });
    } catch (e) {
      if (e instanceof ProviderError && e.code === "ACQ.TRADE_NOT_EXIST") return;
      throw e;
    }
  }

  /** alipay.system.oauth.token: exchange auth_code for an access token (server-side only). */
  async oauthToken(authCode: string): Promise<{ accessToken: string; userKey: string }> {
    const node = await this.exec<OauthTokenNode>("alipay.system.oauth.token", {
      params: { grant_type: "authorization_code", code: authCode },
    });
    const userKey = node.open_id ?? node.user_id;
    if (!node.access_token || !userKey) throw new ProviderError("alipay", "OAUTH_TOKEN_INCOMPLETE", "no access_token / user id in response");
    return { accessToken: node.access_token, userKey };
  }

  /** alipay.user.info.share: nickname & avatar (requires the 获取会员信息 capability). */
  async userInfo(accessToken: string): Promise<{ userKey?: string; nickname?: string; avatar?: string }> {
    const node = await this.exec<UserInfoNode>("alipay.user.info.share", { params: { auth_token: accessToken } });
    return { userKey: node.open_id ?? node.user_id, nickname: node.nick_name, avatar: node.avatar };
  }

  /** Authorisation page URL for user login (scope auth_user = nickname + avatar). */
  authorizeUrl(redirectUri: string, state: string): string {
    const u = new URL(this.cfg.authUrl);
    u.searchParams.set("app_id", this.cfg.appId);
    u.searchParams.set("scope", "auth_user");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    return u.toString();
  }

  get config(): AlipayConfig {
    return this.cfg;
  }
}

let client: AlipayClient | undefined;

export async function alipay(): Promise<AlipayClient> {
  if (!client) {
    const cfg = alipayConfig();
    if (cfg.mode === "mock") {
      const { mockAlipayTransport } = await import("@/lib/mock/alipay-provider");
      client = new AlipayClient(cfg, mockAlipayTransport);
    } else {
      client = new AlipayClient(cfg);
    }
  }
  return client;
}
