import { guardUserPost, json, jsonError, publicOrder } from "@/lib/http";
import { log } from "@/lib/log";
import { getOrderForUser } from "@/lib/payments/orders";
import { closeOrder } from "@/lib/payments/sync";

/** User cancels a pending order: close at the provider, then locally. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardUserPost(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const order = await getOrderForUser(id, g.session.user.id);
  if (!order) return jsonError(404, "not_found");
  try {
    const result = await closeOrder(order, "cancelled_by_user");
    return json({ order: publicOrder(result ?? order) });
  } catch (e) {
    log.error("order.close_failed", { orderId: id, message: (e as Error).message });
    return jsonError(502, "provider_error");
  }
}
