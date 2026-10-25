import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getOrderByOutTradeNo, listOrdersForUser } from "@/lib/payments/orders";
import { formatCny, providerLabel } from "@/lib/ui";

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
  const orders = await listOrdersForUser(user.id);
  return (
    <>
      <h1>Your orders</h1>
      <section className="card table-wrap">
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No orders yet. <Link href="/checkout">Buy the test item</Link>.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Order no.</th>
                <th>Provider</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</td>
                  <td className="mono">
                    <Link href={`/orders/${o.id}`}>{o.outTradeNo}</Link>
                  </td>
                  <td>{providerLabel(o.provider)}</td>
                  <td>{formatCny(o.amountFen)}</td>
                  <td>
                    <span className={`badge ${o.status}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
