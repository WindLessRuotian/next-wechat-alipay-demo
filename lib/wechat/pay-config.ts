import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import { loadPrivateKey, loadPublicKey } from "@/lib/crypto";
import { mockKeys } from "@/lib/mock/keys";

export interface WechatPayConfig {
  mode: "mock" | "sandbox" | "live";
  mchId: string;
  appId: string;
  apiV3Key: string;
  merchantSerialNo: string;
  merchantPrivateKey: crypto.KeyObject;
  platformPublicKey: crypto.KeyObject;
  platformKeyId: string;
  notifyUrl: string;
  baseUrl: string;
}

let cached: WechatPayConfig | undefined;

const readKeyFile = (p: string): string => fs.readFileSync(path.resolve(/*turbopackIgnore: true*/ process.cwd(), p), "utf8");

export function wechatPayConfig(): WechatPayConfig {
  if (cached) return cached;
  const e = env();
  const notifyUrl = e.WECHAT_PAY_NOTIFY_URL ?? new URL("/api/pay/wechat/notify", e.APP_URL).toString();

  if (e.wechatMode === "mock") {
    const k = mockKeys();
    cached = {
      mode: "mock",
      mchId: "1900000000",
      appId: "wxMOCK000000000000",
      apiV3Key: k.wechatApiV3Key,
      merchantSerialNo: k.wechatMerchantSerial,
      merchantPrivateKey: loadPrivateKey(k.wechatMerchant.privateKey),
      platformPublicKey: loadPublicKey(k.wechatPlatform.publicKey),
      platformKeyId: k.wechatPlatformKeyId,
      notifyUrl,
      baseUrl: "mock://api.mch.weixin.qq.com",
    };
    return cached;
  }

  // env() has already guaranteed these are present when not in mock mode.
  const req = (v: string | undefined, name: string): string => {
    if (!v) throw new Error(`${name} missing`);
    return v;
  };
  cached = {
    mode: e.wechatMode,
    mchId: req(e.WECHAT_PAY_MCH_ID, "WECHAT_PAY_MCH_ID"),
    appId: req(e.WECHAT_PAY_APP_ID, "WECHAT_PAY_APP_ID"),
    apiV3Key: req(e.WECHAT_PAY_API_V3_KEY, "WECHAT_PAY_API_V3_KEY"),
    merchantSerialNo: req(e.WECHAT_PAY_CERT_SERIAL_NO, "WECHAT_PAY_CERT_SERIAL_NO"),
    merchantPrivateKey: loadPrivateKey(readKeyFile(req(e.WECHAT_PAY_PRIVATE_KEY_PATH, "WECHAT_PAY_PRIVATE_KEY_PATH"))),
    platformPublicKey: loadPublicKey(readKeyFile(req(e.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH, "WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH"))),
    platformKeyId: req(e.WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID, "WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID"),
    notifyUrl,
    // WeChat Pay v3 has no public sandbox: "sandbox" means real API with a 0.01 CNY item.
    baseUrl: "https://api.mch.weixin.qq.com",
  };
  return cached;
}

export function __resetWechatPayConfigForTests(): void {
  cached = undefined;
}
