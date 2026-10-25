import { handleAlipayNotify } from "@/lib/payments/alipay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alipay → us: application/x-www-form-urlencoded POST; reply must be the plain text "success". */
export async function POST(req: Request) {
  const raw = await req.text();
  const reply = await handleAlipayNotify(raw);
  return new Response(reply.body, { status: reply.status, headers: { "Content-Type": reply.contentType } });
}
