import crypto from "node:crypto";

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString("base64url");

export const hmacSha256 = (key: string, data: string): string =>
  crypto.createHmac("sha256", key).update(data).digest("base64url");

/** Constant-time string comparison (length leak only). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Merchant order number: 32 chars max, [A-Za-z0-9] only — valid for both providers. */
export function newOutTradeNo(now = new Date()): string {
  const d = now.toISOString().replace(/\D/g, "").slice(0, 14); // yyyyMMddHHmmss (UTC)
  return `T${d}${crypto.randomBytes(8).toString("hex").toUpperCase()}`; // 1 + 14 + 16 = 31
}

/**
 * Accept a key either as a full PEM or as the bare base64 body that the
 * Alipay key tool / console shows, and return a KeyObject.
 */
export function loadPrivateKey(input: string): crypto.KeyObject {
  const text = input.replace(/\\n/g, "\n").trim();
  if (text.includes("-----BEGIN")) return crypto.createPrivateKey(text);
  const der = Buffer.from(text.replace(/\s+/g, ""), "base64");
  try {
    return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  } catch {
    return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs1" });
  }
}

export function loadPublicKey(input: string): crypto.KeyObject {
  const text = input.replace(/\\n/g, "\n").trim();
  if (text.includes("-----BEGIN")) return crypto.createPublicKey(text);
  const der = Buffer.from(text.replace(/\s+/g, ""), "base64");
  try {
    return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
  } catch {
    return crypto.createPublicKey({ key: der, format: "der", type: "pkcs1" });
  }
}

export const rsaSha256Sign = (key: crypto.KeyObject, message: string): string =>
  crypto.sign("sha256", Buffer.from(message, "utf8"), key).toString("base64");

export function rsaSha256Verify(key: crypto.KeyObject, message: string, signatureB64: string): boolean {
  try {
    return crypto.verify("sha256", Buffer.from(message, "utf8"), key, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

/** Redact long opaque values before logging (tokens, codes, signatures). */
export function redact(value: string | null | undefined): string {
  if (!value) return String(value);
  return value.length <= 8 ? "***" : `${value.slice(0, 4)}…(${value.length})`;
}
