import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isMockProvider, mockAuthorizeRedirect, PERSONAS, safeRedirectUri } from "@/lib/mock/authorize";

/** MOCK provider: the user clicked "Authorise" on the mock consent screen (plain HTML form POST). */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isMockProvider(provider)) return jsonError(404, "not_found");
  const form = await req.formData();
  const target = safeRedirectUri(String(form.get("redirect_uri") ?? ""), provider);
  if (!target) return jsonError(400, "redirect_uri_not_registered");
  const decision = form.get("decision") === "deny" ? "deny" : "allow";
  const nickname = String(form.get("nickname") ?? "").slice(0, 40) || PERSONAS[provider][0]!.name;
  const hue = Number(form.get("hue") ?? 200) || 200;
  const to = await mockAuthorizeRedirect(provider, target, String(form.get("state") ?? ""), decision, nickname, hue);
  return NextResponse.redirect(to, 303);
}
