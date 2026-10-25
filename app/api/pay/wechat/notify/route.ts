import { handleWechatNotify } from "@/lib/payments/wechat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** WeChat Pay → us. The RAW body is required: the signature covers the exact bytes. */
export async function POST(req: Request) {
  const raw = await req.text();
  const reply = await handleWechatNotify(raw, req.headers);
  return new Response(reply.status === 204 ? null : reply.body, {
    status: reply.status,
    headers: reply.status === 204 ? {} : { "Content-Type": reply.contentType },
  });
}
