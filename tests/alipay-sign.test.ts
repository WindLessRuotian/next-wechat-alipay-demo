import { describe, expect, it } from "vitest";
import {
  extractResponseNode,
  notifySignContent,
  requestSignContent,
  signNotifyAsAlipay,
  signRequest,
  signResponseAsAlipay,
  verifyNotify,
  verifyResponse,
} from "@/lib/alipay/sign";
import { rsaSha256Verify } from "@/lib/crypto";
import { keyPair } from "./helpers";

const alipay = keyPair();
const app = keyPair();

describe("Alipay request signing", () => {
  it("sorts keys, drops sign and empty values", () => {
    expect(requestSignContent({ b: "2", a: "1", sign: "x", empty: "", c: undefined })).toBe("a=1&b=2");
  });
  it("produces an RSA2 signature over the sign content", () => {
    const p = signRequest({ app_id: "1", method: "alipay.trade.query", biz_content: '{"out_trade_no":"T1"}' }, app.privateKey);
    expect(rsaSha256Verify(app.publicKey, requestSignContent(p), p.sign!)).toBe(true);
  });
});

describe("Alipay notification verification", () => {
  it("builds the pre-sign string as documented (drop sign & sign_type, sort, join with &)", () => {
    // Example taken from Alipay's async-notification documentation (global.alipay.com/doc/web/async).
    const params = {
      notify_id: "5b89a773c60af059d96b1693dd3b3d6nc1",
      notify_type: "trade_status_sync",
      sign: "b34d89788d9012f77f5b74ac232145f5",
      trade_no: "2018110922001332950500389138",
      total_fee: "0.01",
      out_trade_no: "test20181109153145",
      notify_time: "2018-11-09 15:36:17",
      currency: "USD",
      trade_status: "TRADE_FINISHED",
      sign_type: "MD5",
    };
    expect(notifySignContent(params)).toBe(
      "currency=USD&notify_id=5b89a773c60af059d96b1693dd3b3d6nc1&notify_time=2018-11-09 15:36:17&notify_type=trade_status_sync&out_trade_no=test20181109153145&total_fee=0.01&trade_no=2018110922001332950500389138&trade_status=TRADE_FINISHED",
    );
  });

  const signed = signNotifyAsAlipay({ out_trade_no: "T1", total_amount: "0.01", trade_status: "TRADE_SUCCESS", notify_id: "n1", subject: "中文 & 符号=ok" }, alipay.privateKey);

  it("accepts a genuine notification (including non-ASCII values)", () => expect(verifyNotify(signed, alipay.publicKey)).toEqual({ ok: true }));
  it("survives form-encoding round-trip", () => {
    const decoded = Object.fromEntries(new URLSearchParams(new URLSearchParams(signed).toString()));
    expect(verifyNotify(decoded, alipay.publicKey)).toEqual({ ok: true });
  });
  it("rejects a tampered amount", () => expect(verifyNotify({ ...signed, total_amount: "100.00" }, alipay.publicKey).ok).toBe(false));
  it("rejects an injected extra field", () => expect(verifyNotify({ ...signed, trade_status: "TRADE_SUCCESS", extra: "1" }, alipay.publicKey).ok).toBe(false));
  it("rejects a signature made with the APP key instead of the Alipay key", () => {
    const forged = signNotifyAsAlipay({ out_trade_no: "T1", total_amount: "0.01" }, app.privateKey);
    expect(verifyNotify(forged, alipay.publicKey)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("rejects non-RSA2 and unsigned notifications", () => {
    expect(verifyNotify({ ...signed, sign_type: "RSA" }, alipay.publicKey)).toEqual({ ok: false, reason: "unsupported_sign_type" });
    const { sign: _omit, ...unsigned } = signed;
    void _omit;
    expect(verifyNotify(unsigned, alipay.publicKey)).toEqual({ ok: false, reason: "missing_sign" });
  });
});

describe("Alipay synchronous response verification", () => {
  it("extracts the exact node text, ignoring braces inside strings", () => {
    const raw = '{"x_response":{"a":"}{\\"","b":{"c":1}},"sign":"S"}';
    expect(extractResponseNode(raw, "x_response")).toBe('{"a":"}{\\"","b":{"c":1}}');
  });
  it("verifies a signed response and rejects a modified one", () => {
    const raw = signResponseAsAlipay("alipay.trade.query", { code: "10000", msg: "Success", trade_status: "TRADE_SUCCESS" }, alipay.privateKey);
    const ok = verifyResponse(raw, "alipay.trade.query", alipay.publicKey);
    expect(ok.ok).toBe(true);
    const bad = verifyResponse(raw.replace("TRADE_SUCCESS", "TRADE_CLOSED"), "alipay.trade.query", alipay.publicKey);
    expect(bad).toMatchObject({ ok: false, reason: "bad_signature" });
  });
  it("falls back to error_response", () => {
    const raw = signResponseAsAlipay("x", { code: "40002", msg: "Invalid Arguments" }, alipay.privateKey, "error_response");
    expect(verifyResponse(raw, "alipay.system.oauth.token", alipay.publicKey)).toMatchObject({ ok: true, nodeName: "error_response" });
  });
});
