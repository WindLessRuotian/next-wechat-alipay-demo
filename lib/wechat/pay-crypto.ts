/**
 * WeChat Pay API v3 cryptography — pure functions, no I/O, fully unit-tested.
 *
 * References (official):
 *  - Request signing:  Authorization: WECHATPAY2-SHA256-RSA2048 mchid=..,nonce_str=..,signature=..,timestamp=..,serial_no=..
 *    message = METHOD\nURL(path+query)\nTIMESTAMP\nNONCE\nBODY\n, SHA256withRSA, base64.
 *  - Response / notification verification: message = TIMESTAMP\nNONCE\nBODY\n,
 *    headers Wechatpay-Timestamp / -Nonce / -Signature / -Serial.
 *  - Notification resource: AEAD_AES_256_GCM, key = APIv3 key (32 bytes),
 *    ciphertext = base64(cipher || 16-byte tag).
 *    https://pay.weixin.qq.com/docs/merchant/products/notification/introduction.html
 */
import crypto from "node:crypto";
import { rsaSha256Sign, rsaSha256Verify } from "@/lib/crypto";

export const AUTH_SCHEMA = "WECHATPAY2-SHA256-RSA2048";
/** WeChat Pay deliberately sends invalid signatures with this prefix to probe merchants. */
export const SIGN_PROBE_PREFIX = "WECHATPAY/SIGNTEST/";
/** Reject notifications whose timestamp is too far from our clock (replay window). */
export const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export function buildRequestMessage(method: string, urlPathWithQuery: string, timestamp: string, nonce: string, body: string): string {
  return `${method.toUpperCase()}\n${urlPathWithQuery}\n${timestamp}\n${nonce}\n${body}\n`;
}

export function buildAuthorization(opts: {
  mchId: string;
  serialNo: string;
  privateKey: crypto.KeyObject;
  method: string;
  urlPathWithQuery: string;
  body: string;
  timestamp?: string;
  nonce?: string;
}): string {
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = opts.nonce ?? crypto.randomBytes(16).toString("hex");
  const signature = rsaSha256Sign(opts.privateKey, buildRequestMessage(opts.method, opts.urlPathWithQuery, timestamp, nonce, opts.body));
  return `${AUTH_SCHEMA} mchid="${opts.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${opts.serialNo}"`;
}

export interface SignedHeaders {
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
  serial: string | null;
}

export function readSignedHeaders(h: Headers): SignedHeaders {
  return {
    timestamp: h.get("wechatpay-timestamp"),
    nonce: h.get("wechatpay-nonce"),
    signature: h.get("wechatpay-signature"),
    serial: h.get("wechatpay-serial"),
  };
}

export type VerifyFailure =
  | "missing_headers"
  | "signature_probe"
  | "unknown_serial"
  | "stale_timestamp"
  | "bad_signature";

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

/** Verify a WeChat Pay response or notification against the platform public key. */
export function verifyWechatSignature(opts: {
  headers: SignedHeaders;
  body: string;
  platformPublicKey: crypto.KeyObject;
  platformKeyId: string;
  nowSeconds?: number;
}): VerifyResult {
  const { timestamp, nonce, signature, serial } = opts.headers;
  if (!timestamp || !nonce || !signature || !serial) return { ok: false, reason: "missing_headers" };
  if (signature.startsWith(SIGN_PROBE_PREFIX)) return { ok: false, reason: "signature_probe" };
  if (serial !== opts.platformKeyId) return { ok: false, reason: "unknown_serial" };
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_CLOCK_SKEW_SECONDS) return { ok: false, reason: "stale_timestamp" };
  const message = `${timestamp}\n${nonce}\n${opts.body}\n`;
  return rsaSha256Verify(opts.platformPublicKey, message, signature) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

export interface EncryptedResource {
  algorithm: string;
  ciphertext: string;
  associated_data?: string;
  nonce: string;
  original_type?: string;
}

const GCM_TAG_BYTES = 16;

export function decryptResource(resource: EncryptedResource, apiV3Key: string): string {
  if (resource.algorithm !== "AEAD_AES_256_GCM") throw new Error(`unsupported algorithm ${resource.algorithm}`);
  const key = Buffer.from(apiV3Key, "utf8");
  if (key.length !== 32) throw new Error("APIv3 key must be 32 bytes");
  const data = Buffer.from(resource.ciphertext, "base64");
  if (data.length <= GCM_TAG_BYTES) throw new Error("ciphertext too short");
  const tag = data.subarray(data.length - GCM_TAG_BYTES);
  const enc = data.subarray(0, data.length - GCM_TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(resource.nonce, "utf8"));
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from(resource.associated_data ?? "", "utf8"));
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Inverse of decryptResource — used only by the mock provider and tests. */
export function encryptResource(plaintext: string, apiV3Key: string, associatedData = "transaction"): EncryptedResource {
  const nonce = crypto.randomBytes(6).toString("hex"); // 12 chars, like WeChat's 12-byte nonce
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(apiV3Key, "utf8"), Buffer.from(nonce, "utf8"));
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { algorithm: "AEAD_AES_256_GCM", ciphertext: enc.toString("base64"), associated_data: associatedData, nonce, original_type: "transaction" };
}

/** Sign a body the way the WeChat Pay platform does (mock provider / tests only). */
export function signAsPlatform(body: string, platformPrivateKey: crypto.KeyObject, platformKeyId: string, nowSeconds?: number): Record<string, string> {
  const timestamp = String(nowSeconds ?? Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("hex");
  return {
    "Wechatpay-Timestamp": timestamp,
    "Wechatpay-Nonce": nonce,
    "Wechatpay-Serial": platformKeyId,
    "Wechatpay-Signature": rsaSha256Sign(platformPrivateKey, `${timestamp}\n${nonce}\n${body}\n`),
    "Wechatpay-Signature-Type": AUTH_SCHEMA,
  };
}

/** Decrypted `transaction` object from a TRANSACTION.SUCCESS notification / query (subset we use). */
export interface WechatTransaction {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id?: string;
  trade_state: "SUCCESS" | "REFUND" | "NOTPAY" | "CLOSED" | "REVOKED" | "USERPAYING" | "PAYERROR";
  trade_state_desc?: string;
  success_time?: string;
  amount?: { total: number; payer_total?: number; currency: string; payer_currency?: string };
}

export interface WechatNotification {
  id: string;
  create_time: string;
  event_type: string;
  resource_type: string;
  resource: EncryptedResource;
  summary?: string;
}
