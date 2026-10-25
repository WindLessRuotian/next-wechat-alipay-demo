import type { Metadata } from "next";
import Link from "next/link";
import { OrderList, toOrderRow } from "@/components/OrderList";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ChannelIcon, Hint, Money, PageHeading } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { accountsForUser } from "@/lib/auth/users";
import { TEST_ITEM } from "@/lib/catalog";
import { fenToYuan } from "@/lib/money";
import { listOrdersForUser } from "@/lib/payments/orders";
import { ERROR_MESSAGES, ITEM_NAME, providerLabel } from "@/lib/ui";

export const metadata: Metadata = { title: "控制台" };

const TZ = "Asia/Shanghai";

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < 5) return "夜深了";
  if (hour < 11) return "上午好";
  if (hour < 13) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function longDate(now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("zh-CN", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "long" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year} 年 ${parts.month} 月 ${parts.day} 日 · ${parts.weekday}`;
}

function Stat({ label, icon, value, unit, meta, highlight }: { label: string; icon: IconName; value: React.ReactNode; unit?: string; meta: string; highlight?: boolean }) {
  return (
    <section className={`card stat ${highlight ? "highlight" : ""}`}>
      <div className="row between">
        <span className="label">{label}</span>
        <span className="mini-icon">
          <Icon name={icon} />
        </span>
      </div>
      <div className="number">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <p className="meta">{meta}</p>
    </section>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string; linked?: string }> }) {
  const { user, provider } = await requireSession();
  const { error, linked } = await searchParams;
  const [accounts, orders] = await Promise.all([accountsForUser(user.id), listOrdersForUser(user.id)]);

  // Statistics come from this user's own orders only.
  const paid = orders.filter((o) => o.status === "paid");
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const paidFen = paid.reduce((sum, o) => sum + o.amountFen, 0);
  const now = new Date();

  return (
    <>
      <PageHeading title={`${greeting(now)}，${user.name}`} desc="在这里管理你的账号连接与每一笔体验订单。" extra={<span className="date">{longDate(now)}</span>} />

      {(error || linked) && (
        <div className="page-alerts">
          {error && (
            <Hint tone="red" icon="link">
              {ERROR_MESSAGES[error] ?? "操作未完成，请稍后重试。"}
            </Hint>
          )}
          {linked && (
            <Hint tone="green" icon="check">
              账号关联成功：两个渠道身份现在指向同一个本地账号，可任选其一登录。
            </Hint>
          )}
        </div>
      )}

      <div className="stats">
        <Stat label="累计订单" icon="file" value={orders.length} unit="笔" meta="当前账号的全部订单" />
        <Stat label="已完成订单" icon="check" value={paid.length} unit="笔" meta="支付结果已由服务端确认" />
        <Stat label="待支付订单" icon="clock" value={pendingCount} unit="笔" meta="请在订单有效期内完成支付" />
        <Stat
          label="累计支付金额"
          icon="wallet"
          value={
            <>
              <span className="currency">¥</span>
              {fenToYuan(paidFen)}
            </>
          }
          meta="仅统计已支付订单"
          highlight
        />
      </div>

      <div className="dash-grid">
        <section className="card product-card">
          <div className="row">
            <span className="product-tile">
              <Icon name="box" />
            </span>
            <div className="flex1">
              <div className="row" style={{ gap: 8 }}>
                <h2>{ITEM_NAME}</h2>
                <span className="tag">TEST ITEM</span>
              </div>
              <p className="caption">以最小金额，体验完整支付闭环</p>
            </div>
          </div>
          <div className="product-details">
            <span>
              <Icon name="check" small />
              微信 / 支付宝
            </span>
            <span>
              <Icon name="check" small />
              实时订单状态
            </span>
          </div>
          <div className="product-footer">
            <div>
              <p className="price-note">体验价 · 价格由服务端确定</p>
              <Money fen={TEST_ITEM.amountFen} unit="/ 次" />
            </div>
            <Link className="btn primary" href="/checkout">
              <Icon name="arrow" />
              立即体验
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>账号连接</h2>
            <span className="muted" style={{ fontSize: 12 }}>
              {accounts.length} / 2 已关联
            </span>
          </div>
          <div className="account-list">
            {(["wechat", "alipay"] as const).map((p) => {
              const a = accounts.find((x) => x.provider === p);
              return (
                <div key={p} className="account-row">
                  <ChannelIcon provider={p} />
                  <div className="flex1">
                    <div className="name">{providerLabel(p)}</div>
                    <div className="description ellipsis">
                      {a ? `${a.nickname ?? "未提供昵称"} · ${provider === p ? "当前登录方式" : "已关联，可用于登录"}` : "关联后可使用同一个账号登录"}
                    </div>
                  </div>
                  {a ? (
                    <span className="badge green">已关联</span>
                  ) : (
                    // A full navigation: the server issues the OAuth state cookie with link intent.
                    <a className="link-btn" href={`/api/auth/${p}/login?link=1`}>
                      关联账号 <Icon name="link" small />
                    </a>
                  )}
                </div>
              );
            })}
            <div className="tiny-note">
              <Icon name="shield" small />
              关联账号不等于授权扣款；每笔付款仍需在渠道内确认。
            </div>
          </div>
        </section>
      </div>

      <section className="card table-card dash-recent">
        <div className="card-head">
          <h2>最近订单</h2>
          <Link className="link-btn" href="/orders">
            全部订单 <Icon name="arrow" small />
          </Link>
        </div>
        {orders.length ? (
          <OrderList rows={orders.slice(0, 4).map(toOrderRow)} />
        ) : (
          <div className="empty-state">
            <div className="result-icon gray">
              <Icon name="file" />
            </div>
            <h3>还没有订单</h3>
            <p className="caption">购买体验商品，走一遍完整的下单、付款与通知流程。</p>
            <div className="actions">
              <Link className="btn primary" href="/checkout">
                立即体验
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
