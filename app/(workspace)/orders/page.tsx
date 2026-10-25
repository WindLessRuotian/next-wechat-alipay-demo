import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { toOrderRow } from "@/components/OrderList";
import OrdersBrowser from "@/components/OrdersBrowser";
import { Icon } from "@/components/ui/Icon";
import { Hint, PageHeading } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { getOrderByOutTradeNo, listOrdersForUser } from "@/lib/payments/orders";
import { expireOverdueOrders } from "@/lib/payments/sync";

export const metadata: Metadata = { title: "我的订单" };

/**
 * Also the Alipay return_url. The query string Alipay appends here is NOT used
 * to decide anything about payment status — we only use out_trade_no to find
 * the order page, whose status comes from the notify handler / server query.
 */
export default async function Orders({ searchParams }: { searchParams: Promise<{ out_trade_no?: string }> }) {
  const { user } = await requireSession();
  const { out_trade_no } = await searchParams;
  if (out_trade_no) {
    const o = await getOrderByOutTradeNo("alipay", out_trade_no);
    if (o && o.userId === user.id) redirect(`/orders/${o.id}?from=return`);
  }
  // Close this user's overdue orders before listing, so the list never shows an expired order as pending.
  await expireOverdueOrders(user.id);
  const orders = await listOrdersForUser(user.id);

  return (
    <>
      <PageHeading
        title="我的订单"
        desc="查看当前账号的全部交易，追踪每一笔支付进度。"
        extra={
          <Link className="btn primary" href="/checkout">
            <Icon name="bag" />
            购买体验商品
          </Link>
        }
      />
      <OrdersBrowser orders={orders.map(toOrderRow)} />
      <Hint icon="shield" className="list-footnote">
        仅展示当前账号的订单。支付状态以服务端通知或主动查单结果为准。
      </Hint>
    </>
  );
}
