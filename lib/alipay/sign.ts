/**
 * Alipay Open Platform RSA2 (SHA256withRSA) signing & verification — pure functions.
 *
 * Request signing (common params + business params):
 *   drop `sign`, drop empty values, sort keys by ASCII, join as k=v with '&', sign, base64.
 * Async notification verification:
 *   drop `sign` and `sign_type`, sort the remaining keys, join k=v with '&' (values already
 *   URL-decoded), verify with the *Alipay public key* (not the app public key).
 *   https://global.alipay.com/doc/web/async  (same algorithm as the CN Open Platform SDK's rsaCheckV1)
 * Synchronous API responses:
 *   the signature covers the exact JSON text of the `<method>_response` node.
 */
import type crypto from "node:crypto";
import { rsaSha256Sign, rsaSha256Verify } from "@/lib/crypto";

export type Params = Record<string, string>;

export function requestSignContent(params: Record<string, string | undefined>): string {
  return Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

export function signRequest(params: Record<string, string | undefined>, appPrivateKey: crypto.KeyObject): Params {
  const clean: Params = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") clean[k] = v;
  return { ...clean, sign: rsaSha256Sign(appPrivateKey, requestSignContent(clean)) };
}

export function notifySignContent(params: Params): string {
  return Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

export type NotifyVerifyResult = { ok: true } | { ok: false; reason: "missing_sign" | "unsupported_sign_type" | "bad_signature" };

export function verifyNotify(params: Params, alipayPublicKey: crypto.KeyObject): NotifyVerifyResult {
  if (!params.sign) return { ok: false, reason: "missing_sign" };
  if (params.sign_type && params.sign_type !== "RSA2") return { ok: false, reason: "unsupported_sign_type" };
  return rsaSha256Verify(alipayPublicKey, notifySignContent(params), params.sign) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** Mock provider / tests: sign a notification the way Alipay does. */
export function signNotifyAsAlipay(params: Params, alipayPrivateKey: crypto.KeyObject): Params {
  const p = { ...params, sign_type: "RSA2" };
  return { ...p, sign: rsaSha256Sign(alipayPrivateKey, notifySignContent(p)) };
}

/**
 * Extract the raw JSON text of `"<nodeName>": {...}` from a response body without
 * re-serialising it (re-serialising could change escaping and break the signature).
 */
export function extractResponseNode(raw: string, nodeName: string): string | null {
  const key = `"${nodeName}"`;
  let i = raw.indexOf(key);
  if (i < 0) return null;
  i = raw.indexOf("{", i + key.length);
  if (i < 0) return null;
  let depth = 0;
  let inString = false;
  for (let j = i; j < raw.length; j++) {
    const c = raw[j];
    if (inString) {
      if (c === "\\") j++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return raw.slice(i, j + 1);
  }
  return null;
}

export const responseNodeName = (method: string): string => `${method.replace(/\./g, "_")}_response`;

export type ResponseVerifyResult<T> =
  | { ok: true; node: T; nodeName: string }
  | { ok: false; reason: "no_response_node" | "missing_sign" | "bad_signature"; node?: T };

export function verifyResponse<T = Record<string, unknown>>(raw: string, method: string, alipayPublicKey: crypto.KeyObject): ResponseVerifyResult<T> {
  let nodeName = responseNodeName(method);
  let nodeText = extractResponseNode(raw, nodeName);
  if (!nodeText) {
    nodeName = "error_response";
    nodeText = extractResponseNode(raw, nodeName);
  }
  if (!nodeText) return { ok: false, reason: "no_response_node" };
  const node = JSON.parse(nodeText) as T;
  const sign = (JSON.parse(raw) as { sign?: string }).sign;
  if (!sign) return { ok: false, reason: "missing_sign", node };
  return rsaSha256Verify(alipayPublicKey, nodeText, sign) ? { ok: true, node, nodeName } : { ok: false, reason: "bad_signature", node };
}

/** Mock provider / tests: produce a signed response body. */
export function signResponseAsAlipay(
  method: string,
  node: Record<string, unknown>,
  alipayPrivateKey: crypto.KeyObject,
  nodeName: string = responseNodeName(method),
): string {
  const nodeText = JSON.stringify(node);
  return `{"${nodeName}":${nodeText},"sign":"${rsaSha256Sign(alipayPrivateKey, nodeText)}"}`;
}
