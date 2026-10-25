import { describe, expect, it } from "vitest";
import { rsaSha256Verify } from "@/lib/crypto";
import {
  buildAuthorization,
  buildRequestMessage,
  decryptResource,
  encryptResource,
  signAsPlatform,
  verifyWechatSignature,
  type SignedHeaders,
} from "@/lib/wechat/pay-crypto";
import { keyPair } from "./helpers";

const platform = keyPair();
const merchant = keyPair();
const KEY_ID = "PUB_KEY_ID_0100000000000000000000000000";
const APIV3 = "0123456789abcdefghijklmnopqrstuv"; // 32 bytes

const headersOf = (h: Record<string, string>): SignedHeaders => ({
  timestamp: h["Wechatpay-Timestamp"] ?? null,
  nonce: h["Wechatpay-Nonce"] ?? null,
  signature: h["Wechatpay-Signature"] ?? null,
  serial: h["Wechatpay-Serial"] ?? null,
});

describe("WeChat Pay v3 request signing", () => {
  it("builds the documented Authorization header and a verifiable signature", () => {
    const body = '{"mchid":"1900000001"}';
    const auth = buildAuthorization({
      mchId: "1900000001",
      serialNo: "SERIAL123",
      privateKey: merchant.privateKey,
      method: "POST",
      urlPathWithQuery: "/v3/pay/transactions/native",
      body,
      timestamp: "1554208460",
      nonce: "593BEC0C930BF1AFEB40B4A08C8FB242",
    });
    expect(auth).toMatch(/^WECHATPAY2-SHA256-RSA2048 mchid="1900000001",nonce_str="593BEC0C930BF1AFEB40B4A08C8FB242",signature="[A-Za-z0-9+/=]+",timestamp="1554208460",serial_no="SERIAL123"$/);
    const sig = /signature="([^"]+)"/.exec(auth)![1]!;
    const msg = buildRequestMessage("POST", "/v3/pay/transactions/native", "1554208460", "593BEC0C930BF1AFEB40B4A08C8FB242", body);
    expect(msg).toBe(`POST\n/v3/pay/transactions/native\n1554208460\n593BEC0C930BF1AFEB40B4A08C8FB242\n${body}\n`);
    expect(rsaSha256Verify(merchant.publicKey, msg, sig)).toBe(true);
  });
});

describe("WeChat Pay v3 notification verification", () => {
  const body = '{"id":"EV-1","event_type":"TRANSACTION.SUCCESS"}';
  const now = 1_800_000_000;
  const signed = headersOf(signAsPlatform(body, platform.privateKey, KEY_ID, now));
  const verify = (h: SignedHeaders, b = body, t = now) =>
    verifyWechatSignature({ headers: h, body: b, platformPublicKey: platform.publicKey, platformKeyId: KEY_ID, nowSeconds: t });

  it("accepts a correctly signed body", () => expect(verify(signed)).toEqual({ ok: true }));
  it("rejects a modified body", () => expect(verify(signed, body.replace("EV-1", "EV-2"))).toEqual({ ok: false, reason: "bad_signature" }));
  it("rejects a signature from another key", () => {
    const other = keyPair();
    expect(verify(headersOf(signAsPlatform(body, other.privateKey, KEY_ID, now)))).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("rejects an unknown Wechatpay-Serial", () => expect(verify({ ...signed, serial: "PUB_KEY_ID_OTHER" })).toEqual({ ok: false, reason: "unknown_serial" }));
  it("rejects timestamps outside the 5-minute window (replay)", () =>
    expect(verify(signed, body, now + 301)).toEqual({ ok: false, reason: "stale_timestamp" }));
  it("rejects missing headers", () => expect(verify({ ...signed, nonce: null })).toEqual({ ok: false, reason: "missing_headers" }));
  it("fails WeChat's signature probes (WECHATPAY/SIGNTEST/)", () =>
    expect(verify({ ...signed, signature: "WECHATPAY/SIGNTEST/abc" })).toEqual({ ok: false, reason: "signature_probe" }));
});

describe("AEAD_AES_256_GCM resource", () => {
  it("round-trips with the APIv3 key", () => {
    const plain = JSON.stringify({ out_trade_no: "T1", trade_state: "SUCCESS" });
    expect(decryptResource(encryptResource(plain, APIV3), APIV3)).toBe(plain);
  });
  it("fails authentication with the wrong key or tampered ciphertext", () => {
    const r = encryptResource("{}", APIV3);
    expect(() => decryptResource(r, "vutsrqponmlkjihgfedcba9876543210")).toThrow();
    const buf = Buffer.from(r.ciphertext, "base64");
    buf[0] = buf[0]! ^ 1;
    expect(() => decryptResource({ ...r, ciphertext: buf.toString("base64") }, APIV3)).toThrow();
    expect(() => decryptResource({ ...r, associated_data: "certificate" }, APIV3)).toThrow();
  });
});
