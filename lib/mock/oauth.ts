import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import type { Provider } from "@/lib/db/schema";

export interface MockProfile {
  providerUserId: string;
  unionId?: string;
  nickname: string;
  avatarUrl: string;
}

const CODE_TTL_MS = 10 * 60 * 1000; // WeChat: code valid 10 minutes, single use

export async function issueMockCode(provider: Provider, profile: MockProfile): Promise<string> {
  const code = `mock_${randomToken(18)}`;
  await (await db())
    .insert(schema.mockOauthCodes)
    .values({ code, provider, profileJson: JSON.stringify(profile), expiresAt: new Date(Date.now() + CODE_TTL_MS) })
    .run();
  return code;
}

/** Single-use exchange, like the real token endpoints. */
export async function consumeMockCode(provider: Provider, code: string): Promise<MockProfile | null> {
  const row = await (await db())
    .update(schema.mockOauthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.mockOauthCodes.code, code), eq(schema.mockOauthCodes.provider, provider), isNull(schema.mockOauthCodes.usedAt)))
    .returning()
    .get();
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return JSON.parse(row.profileJson) as MockProfile;
}

export async function mockProfileByCode(provider: Provider, code: string): Promise<MockProfile | null> {
  const row = await (await db())
    .select()
    .from(schema.mockOauthCodes)
    .where(and(eq(schema.mockOauthCodes.code, code), eq(schema.mockOauthCodes.provider, provider)))
    .get();
  return row ? (JSON.parse(row.profileJson) as MockProfile) : null;
}

/** Deterministic avatar as a data URI so mock mode needs no network. */
export function mockAvatar(seed: string, hue: number): string {
  const letter = (seed.trim()[0] ?? "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="hsl(${hue} 55% 45%)"/><text x="48" y="62" font-size="44" text-anchor="middle" fill="#fff" font-family="sans-serif">${letter.replace(/[<>&"]/g, "")}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
