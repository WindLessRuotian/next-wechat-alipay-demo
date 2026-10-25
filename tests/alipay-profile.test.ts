import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { alipayProfileFromCode } from "@/lib/auth/alipay-profile";
import { upsertUserFromProfile } from "@/lib/auth/users";
import { ProviderError } from "@/lib/payments/errors";

/** Stand-in for AlipayClient: the token call always works, the member-info call is configurable. */
const fakeClient = (userKey: string, userInfo: () => Promise<{ nickname?: string; avatar?: string }>) => ({
  oauthToken: async (code: string) => {
    if (code === "bad") throw new ProviderError("alipay", "isv.code-invalid", "授权码code无效");
    return { accessToken: `at_${code}`, userKey };
  },
  userInfo: async () => userInfo(),
});
const memberServiceDown = async (): Promise<never> => {
  throw new ProviderError("alipay", "aop.unknow-error", "RPC调用业务系统异常");
};

describe("alipayProfileFromCode", () => {
  it("returns the verified user id with nickname and avatar", async () => {
    const p = await alipayProfileFromCode(fakeClient("2088001", async () => ({ nickname: "Ali", avatar: "https://img.test/a.png" })), "ok");
    expect(p).toEqual({ provider: "alipay", providerUserId: "2088001", nickname: "Ali", avatarUrl: "https://img.test/a.png" });
  });

  it("still signs in when the member-info service fails, leaving the profile fields empty", async () => {
    const p = await alipayProfileFromCode(fakeClient("2088002", memberServiceDown), "ok");
    expect(p).toEqual({ provider: "alipay", providerUserId: "2088002", nickname: undefined, avatarUrl: undefined });
  });

  it("does not sign in when the auth_code exchange itself fails", async () => {
    await expect(alipayProfileFromCode(fakeClient("2088003", memberServiceDown), "bad")).rejects.toMatchObject({ code: "isv.code-invalid" });
  });

  it("a later login without profile data keeps the stored nickname; a new user gets a readable placeholder", async () => {
    const uid = crypto.randomUUID();
    const first = await upsertUserFromProfile(await alipayProfileFromCode(fakeClient(uid, async () => ({ nickname: "Ali" })), "ok"));
    await upsertUserFromProfile(await alipayProfileFromCode(fakeClient(uid, memberServiceDown), "ok"));
    const row = (await (await db()).select().from(schema.users).where(eq(schema.users.id, first.id)).get())!;
    expect(row.name).toBe("Ali");

    const fresh = await upsertUserFromProfile(await alipayProfileFromCode(fakeClient(crypto.randomUUID(), memberServiceDown), "ok"));
    expect(fresh.name).toBe("支付宝用户");
  });
});
