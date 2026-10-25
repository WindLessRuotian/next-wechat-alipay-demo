import "server-only";
import type crypto from "node:crypto";
import { env } from "@/lib/env";
import { loadPrivateKey, loadPublicKey } from "@/lib/crypto";
import { mockKeys } from "@/lib/mock/keys";

export interface AlipayConfig {
  mode: "mock" | "sandbox" | "live";
  appId: string;
  sellerId?: string;
  appPrivateKey: crypto.KeyObject;
  alipayPublicKey: crypto.KeyObject;
  /** OpenAPI gateway (…/gateway.do). In mock mode this is a local page. */
  gateway: string;
  /** User authorisation page (…/oauth2/publicAppAuthorize.htm). */
  authUrl: string;
  notifyUrl: string;
  returnUrl: string;
}

let cached: AlipayConfig | undefined;

export function alipayConfig(): AlipayConfig {
  if (cached) return cached;
  const e = env();
  const notifyUrl = e.ALIPAY_NOTIFY_URL ?? new URL("/api/pay/alipay/notify", e.APP_URL).toString();
  const returnUrl = e.ALIPAY_RETURN_URL ?? new URL("/orders", e.APP_URL).toString();

  if (e.alipayMode === "mock") {
    const k = mockKeys();
    cached = {
      mode: "mock",
      appId: "9021000000000000",
      sellerId: "2088000000000000",
      appPrivateKey: loadPrivateKey(k.alipayApp.privateKey),
      alipayPublicKey: loadPublicKey(k.alipayPlatform.publicKey),
      gateway: new URL("/mock/alipay/gateway", e.APP_URL).toString(),
      authUrl: new URL("/mock/oauth/alipay", e.APP_URL).toString(),
      notifyUrl,
      returnUrl,
    };
    return cached;
  }

  const req = (v: string | undefined, name: string): string => {
    if (!v) throw new Error(`${name} missing`);
    return v;
  };
  cached = {
    mode: e.alipayMode,
    appId: req(e.ALIPAY_APP_ID, "ALIPAY_APP_ID"),
    sellerId: e.ALIPAY_SELLER_ID,
    appPrivateKey: loadPrivateKey(req(e.ALIPAY_PRIVATE_KEY, "ALIPAY_PRIVATE_KEY")),
    alipayPublicKey: loadPublicKey(req(e.ALIPAY_PUBLIC_KEY, "ALIPAY_PUBLIC_KEY")),
    gateway: req(e.ALIPAY_GATEWAY, "ALIPAY_GATEWAY"),
    authUrl: req(e.ALIPAY_AUTH_URL, "ALIPAY_AUTH_URL"),
    notifyUrl,
    returnUrl,
  };
  return cached;
}

export function __resetAlipayConfigForTests(): void {
  cached = undefined;
}
