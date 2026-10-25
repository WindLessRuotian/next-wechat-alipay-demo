import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { upsertUserFromProfile } from "@/lib/auth/users";

const userRow = async (userId: string) => (await (await db()).select().from(schema.users).where(eq(schema.users.id, userId)).get())!;
const accountsOf = async (userId: string) => (await db()).select().from(schema.accounts).where(eq(schema.accounts.userId, userId)).all();

describe("upsertUserFromProfile", () => {
  it("re-login with a changed nickname and avatar updates the same local user", async () => {
    const uid = crypto.randomUUID();
    const first = await upsertUserFromProfile({ provider: "wechat", providerUserId: uid, nickname: "Old", avatarUrl: "https://img.test/1.png" });
    const again = await upsertUserFromProfile({ provider: "wechat", providerUserId: uid, nickname: "New", avatarUrl: "https://img.test/2.png" });
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({ name: "New", avatarUrl: "https://img.test/2.png" });
    expect(await userRow(first.id)).toMatchObject({ name: "New", avatarUrl: "https://img.test/2.png" });
    const accounts = await accountsOf(first.id);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ nickname: "New", avatarUrl: "https://img.test/2.png" });
  });

  it("keeps stored values for fields the provider did not return", async () => {
    const uid = crypto.randomUUID();
    const first = await upsertUserFromProfile({ provider: "alipay", providerUserId: uid, nickname: "Ali", avatarUrl: "https://img.test/a.png" });
    await upsertUserFromProfile({ provider: "alipay", providerUserId: uid, nickname: "" });
    expect(await userRow(first.id)).toMatchObject({ name: "Ali", avatarUrl: "https://img.test/a.png" });
    expect((await accountsOf(first.id))[0]).toMatchObject({ nickname: "Ali", avatarUrl: "https://img.test/a.png" });
  });

  it("linking keeps the main profile; signing in with the linked identity switches to it", async () => {
    const owner = await upsertUserFromProfile({ provider: "wechat", providerUserId: crypto.randomUUID(), nickname: "Wei", avatarUrl: "https://img.test/w.png" });
    const aliUid = crypto.randomUUID();

    const linked = await upsertUserFromProfile({ provider: "alipay", providerUserId: aliUid, nickname: "Ali", avatarUrl: "https://img.test/a1.png" }, owner.id);
    expect(linked).toMatchObject({ id: owner.id, name: "Wei", avatarUrl: "https://img.test/w.png" });
    // Running the link flow again for an identity that is already linked doesn't touch it either.
    await upsertUserFromProfile({ provider: "alipay", providerUserId: aliUid, nickname: "Ali 2" }, owner.id);
    expect(await userRow(owner.id)).toMatchObject({ name: "Wei", avatarUrl: "https://img.test/w.png" });

    const signedIn = await upsertUserFromProfile({ provider: "alipay", providerUserId: aliUid, nickname: "Ali 3", avatarUrl: "https://img.test/a3.png" });
    expect(signedIn).toMatchObject({ id: owner.id, name: "Ali 3", avatarUrl: "https://img.test/a3.png" });
    expect(await accountsOf(owner.id)).toHaveLength(2);
  });
});
