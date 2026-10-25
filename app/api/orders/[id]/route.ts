import { getSession } from "@/lib/auth/session";
import { json, jsonError, publicOrder } from "@/lib/http";
import { getOrderForUser } from "@/lib/payments/orders";
import { refreshOrder } from "@/lib/payments/sync";

export const dynamic = "force-dynamic";

/**
 * Polled by /orders/[id]. Returns the server's view of the order; while pending it
 * expires overdue orders and (rate-limited) queries the provider as a fallback.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return jsonError(401, "unauthenticated");
  const { id } = await ctx.params;
  const order = await getOrderForUser(id, session.user.id);
  if (!order) return jsonError(404, "not_found");
  return json({ order: publicOrder(await refreshOrder(order)) });
}
