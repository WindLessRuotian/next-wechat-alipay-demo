import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "@/lib/env";
import { fenToYuan, yuanToFen } from "@/lib/money";

const base = { APP_URL: "http://localhost:3000", SESSION_SECRET: "x".repeat(32), DATABASE_URL: "file:./t.db" };

describe("env validation", () => {
  it("needs no provider credentials in mock mode", () => {
    expect(parseEnv({ ...base, PAYMENT_MODE: "mock" })).toMatchObject({ wechatMode: "mock", alipayMode: "mock" });
  });
  it("lists every missing credential for non-mock providers", () => {
    try {
      parseEnv({ ...base, PAYMENT_MODE: "mock", ALIPAY_MODE: "sandbox" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      expect((e as EnvError).problems.join()).toContain("ALIPAY_PRIVATE_KEY");
      expect((e as EnvError).problems.join()).not.toContain("WECHAT");
    }
  });
  it("rejects a short session secret and a bad APIv3 key length", () => {
    expect(() => parseEnv({ ...base, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
    expect(() =>
      parseEnv({
        ...base,
        WECHAT_MODE: "live",
        WECHAT_APP_ID: "a", WECHAT_APP_SECRET: "a", WECHAT_PAY_MCH_ID: "a", WECHAT_PAY_APP_ID: "a",
        WECHAT_PAY_API_V3_KEY: "too-short", WECHAT_PAY_CERT_SERIAL_NO: "a", WECHAT_PAY_PRIVATE_KEY_PATH: "a",
        WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH: "a", WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID: "a", WECHAT_PAY_NOTIFY_URL: "https://x/n",
      }),
    ).toThrow(/32 bytes/);
  });
});

describe("money", () => {
  it("converts without floating point", () => {
    expect(fenToYuan(1)).toBe("0.01");
    expect(fenToYuan(1234)).toBe("12.34");
    expect(yuanToFen("0.01")).toBe(1);
    expect(yuanToFen("12.3")).toBe(1230);
    expect(yuanToFen("5")).toBe(500);
    expect(yuanToFen("0.001")).toBeNull();
    expect(yuanToFen("-1")).toBeNull();
    expect(yuanToFen("1e2")).toBeNull();
  });
});
