import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OrderPage from "@/components/OrderPage";
import { requireSession } from "@/lib/auth/session";
import { getOrderForUser } from "@/lib/payments/orders";

export const metadata: Metadata = { title: "订单详情" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { user } = await requireSession();
  const { id } = await params;
  const { from } = await searchParams;
  const order = await getOrderForUser(id, user.id);
  if (!order) notFound();
  return <OrderPage order={order} fromReturn={from === "return"} />;
}
