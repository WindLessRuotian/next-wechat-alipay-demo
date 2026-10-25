import "server-only";
import type { AlipayClient } from "@/lib/alipay/client";
import { log } from "@/lib/log";
import type { ProviderProfile } from "./users";

/**
 * auth_code → Alipay identity. The signed alipay.system.oauth.token response *is*
 * the identity (open_id / user_id). Nickname and avatar come from the separate
 * member-info service (alipay.user.info.share); when that service fails, as the
 * sandbox's does at times, sign the user in anyway. The fields left undefined keep
 * whatever profile is already stored, and the next successful login fills them in.
 */
export async function alipayProfileFromCode(client: Pick<AlipayClient, "oauthToken" | "userInfo">, code: string): Promise<ProviderProfile> {
  const token = await client.oauthToken(code);
  let info: { nickname?: string; avatar?: string } = {};
  try {
    info = await client.userInfo(token.accessToken);
  } catch (e) {
    log.warn("auth.profile_unavailable", { provider: "alipay", message: e instanceof Error ? e.message : String(e) });
  }
  return { provider: "alipay", providerUserId: token.userKey, nickname: info.nickname, avatarUrl: info.avatar };
}
