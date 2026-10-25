import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Channel, StatusBadge } from "@/components/ui/primitives";
import { formatCny, formatTime } from "@/lib/ui";

/** Browser-safe summary of an order for lists (the user's own orders only). */
export interface OrderRow {
  id: string;
  outTradeNo: string;
  provider: string;
  status: string;
  amountFen: number;
  createdAt: string;
}

export const toOrderRow = (o: { id: string; outTradeNo: string; provider: string; status: string; amountFen: number; createdAt: Date }): OrderRow => ({
  id: o.id,
  outTradeNo: o.outTradeNo,
  provider: o.provider,
  status: o.status,
  amountFen: o.amountFen,
  createdAt: o.createdAt.toISOString(),
});

/** Table on desktop, stacked cards under 760px (the CSS switches between them). */
export function OrderList({ rows }: { rows: OrderRow[] }) {
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>订单编号</th>
              <th>支付渠道</th>
              <th>金额</th>
              <th>订单状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="mono">{o.outTradeNo}</td>
                <td>
                  <Channel provider={o.provider} />
                </td>
                <td className="number-cell">{formatCny(o.amountFen)}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td className="time-cell">{formatTime(o.createdAt)}</td>
                <td>
                  <Link className="link-btn" href={`/orders/${o.id}`}>
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-order-list">
        {rows.map((o) => (
          <article key={o.id} className="mobile-order-item">
            <div className="row between">
              <span className="mono">{o.outTradeNo}</span>
              <StatusBadge status={o.status} />
            </div>
            <div className="row between" style={{ margin: "12px 0" }}>
              <Channel provider={o.provider} />
              <strong>{formatCny(o.amountFen)}</strong>
            </div>
            <div className="row between">
              <small className="muted">{formatTime(o.createdAt)}</small>
              <Link className="link-btn" href={`/orders/${o.id}`}>
                查看详情 <Icon name="chevron" small />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
