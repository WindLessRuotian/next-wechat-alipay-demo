"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { OrderList, type OrderRow } from "@/components/OrderList";
import { Icon } from "@/components/ui/Icon";
import { STATUS_LABELS, type StatusKey } from "@/lib/ui";

const PAGE_SIZE = 8;
const TABS: { key: "all" | StatusKey; label: string }[] = [
  { key: "all", label: "全部订单" },
  { key: "pending", label: STATUS_LABELS.pending },
  { key: "paid", label: STATUS_LABELS.paid },
  { key: "failed", label: "失败" },
  { key: "closed", label: STATUS_LABELS.closed },
];

/** Filters the signed-in user's own orders (already scoped by the server) in the browser. */
export default function OrdersBrowser({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [status, setStatus] = useState<"all" | StatusKey>("all");
  const [channel, setChannel] = useState<"all" | "wechat" | "alipay">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const q = query.trim().toLowerCase();
  const filtered = orders.filter((o) => (status === "all" || o.status === status) && (channel === "all" || o.provider === channel) && o.outTradeNo.toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = () => {
    setStatus("all");
    setChannel("all");
    setQuery("");
    setPage(1);
  };

  return (
    <section className="card table-card">
      <div className="tabs" role="tablist" aria-label="订单状态">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={status === t.key}
            className={`tab ${status === t.key ? "active" : ""}`}
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
          >
            {t.label}
            <span>{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="table-tools">
        <div className="searchbox">
          <Icon name="search" />
          <input
            type="search"
            aria-label="搜索订单编号"
            placeholder="搜索订单编号…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="select"
          aria-label="筛选支付渠道"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as typeof channel);
            setPage(1);
          }}
        >
          <option value="all">全部支付渠道</option>
          <option value="wechat">微信支付</option>
          <option value="alipay">支付宝</option>
        </select>
        <button type="button" className="link-btn" style={{ fontSize: 12 }} onClick={reset}>
          重置
        </button>
        <span className="flex1" />
        <button type="button" className="btn sm" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
          <Icon name="refresh" small />
          {refreshing ? "刷新中…" : "刷新"}
        </button>
      </div>

      {visible.length ? (
        <OrderList rows={visible} />
      ) : orders.length ? (
        <div className="empty-state">
          <div className="result-icon gray">
            <Icon name="search" />
          </div>
          <h3>没有找到匹配的订单</h3>
          <p className="caption">调整搜索关键词，或清除筛选条件。</p>
          <div className="actions">
            <button type="button" className="link-btn" onClick={reset}>
              清除筛选
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="result-icon gray">
            <Icon name="file" />
          </div>
          <h3>还没有订单</h3>
          <p className="caption">购买体验商品后，订单会出现在这里。</p>
          <div className="actions">
            <Link className="btn primary" href="/checkout">
              购买体验商品
            </Link>
          </div>
        </div>
      )}

      <div className="pagination">
        <span>
          共 {filtered.length} 条记录 · 每页 {PAGE_SIZE} 条
        </span>
        <div className="row" style={{ gap: 7 }}>
          <button type="button" className="page-num" aria-label="上一页" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            ‹
          </button>
          <span className="page-num active" aria-current="page">
            {current}
          </span>
          <button type="button" className="page-num" aria-label="下一页" disabled={current >= pages} onClick={() => setPage(current + 1)}>
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
