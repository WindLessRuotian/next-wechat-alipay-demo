import "server-only";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema, withWriteTransaction } from "@/lib/db";
import type { Provider, User } from "@/lib/db/schema";
import { providerLabel } from "@/lib/ui";

export interface ProviderProfile {
  provider: Provider;
  providerUserId: string;
  unionId?: string;
  nickname?: string;
  avatarUrl?: string;
}

export class LinkError extends Error {
  constructor(public readonly code: "linked_to_other_user" | "provider_already_linked") {
    super(code);
  }
}

/**
 * Find-or-create the local user for an external identity, keyed by
 * (provider, provider_user_id). With `linkToUserId`, attach the identity to
 * that existing user instead (account linking).
 *
 * Profile rule: `users.name` / `users.avatar_url` mirror the identity the user
 * last signed in with. Linking only writes that identity's `accounts` row, and
 * a field the provider did not return never clears a stored value.
 */
export async function upsertUserFromProfile(p: ProviderProfile, linkToUserId?: string): Promise<User> {
  return withWriteTransaction(async (tx): Promise<User> => {
    const now = new Date();
    const existing = await tx
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.provider, p.provider), eq(schema.accounts.providerUserId, p.providerUserId)))
      .get();

    if (existing) {
      if (linkToUserId && existing.userId !== linkToUserId) throw new LinkError("linked_to_other_user");
      await tx
        .update(schema.accounts)
        .set({ nickname: p.nickname || existing.nickname, avatarUrl: p.avatarUrl || existing.avatarUrl, unionId: p.unionId ?? existing.unionId, updatedAt: now })
        .where(eq(schema.accounts.id, existing.id))
        .run();
      const user = (await tx.select().from(schema.users).where(eq(schema.users.id, existing.userId)).get())!;
      if (linkToUserId) return user;
      return (await tx
        .update(schema.users)
        .set({ name: p.nickname || user.name, avatarUrl: p.avatarUrl || user.avatarUrl })
        .where(eq(schema.users.id, user.id))
        .returning()
        .get())!;
    }

    let userId = linkToUserId;
    if (userId) {
      const clash = await tx
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, p.provider)))
        .get();
      if (clash) throw new LinkError("provider_already_linked");
    } else {
      userId = crypto.randomUUID();
      await tx.insert(schema.users).values({ id: userId, name: p.nickname || `${providerLabel(p.provider)}用户`, avatarUrl: p.avatarUrl ?? null }).run();
    }

    await tx
      .insert(schema.accounts)
      .values({
        id: crypto.randomUUID(),
        userId,
        provider: p.provider,
        providerUserId: p.providerUserId,
        unionId: p.unionId ?? null,
        nickname: p.nickname ?? null,
        avatarUrl: p.avatarUrl ?? null,
      })
      .run();
    return (await tx.select().from(schema.users).where(eq(schema.users.id, userId)).get())!;
  });
}

export async function accountsForUser(userId: string) {
  return (await db()).select().from(schema.accounts).where(eq(schema.accounts.userId, userId)).all();
}
