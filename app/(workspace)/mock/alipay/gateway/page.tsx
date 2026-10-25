import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MockCashierClient from "@/components/MockCashierClient";
import { ChannelIcon, DetailList, Hint, Money, PageHeading, Steps } from "@/components/ui/primitives";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { fenToYuan } from "@/lib/money";
import { openMockCashier } from "@/lib/mock/alipay-provider";
import { getOrderByOutTradeNo } from "@/lib/payments/orders";
import { formatCny, formatTime, itemName } from "@/lib/ui";

export const metadata: Metadata = { title: "模拟收银台" };

function Rejected({ reason }: { reason: string }) {
  return (
    <>
      <PageHeading title="模拟收银台" desc="商户请求未通过模拟渠道的校验。" />
      <section className="card cashier-card pad">
        <Hint tone="red" icon="shield">
          {reason}
        </Hint>
      </section>
    </>
  );
}

/**
 * MOCK Alipay cashier (stands in for …/gateway.do?method=alipay.trade.page.pay…).
 * It verifies the merchant's RSA2 request signature with the app public key,
 * exactly as Alipay would, before showing anything.
 */
export default async function MockCashier({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (env().alipayMode !== "mock") notFound();
  const params = await searchParams;
  const opened = await openMockCashier(params);
  if (!opened.ok) return <Rejected reason={`Mock 支付宝拒绝了这次请求：${opened.error}`} />;

  const session = await getSession();
  const order = await getOrderByOutTradeNo("alipay", opened.outTradeNo);
  if (!session || !order || order.userId !== session.user.id) return <Rejected reason="订单不存在，或不属于当前登录账号。" />;

  const returnUrl = new URL(params.return_url ?? `${env().APP_URL}/orders`);
  returnUrl.searchParams.set("out_trade_no", opened.outTradeNo);
  returnUrl.searchParams.set("total_amount", fenToYuan(opened.amountFen));

  return (
    <>
      <PageHeading title="模拟收银台" desc="商户请求已进入模拟渠道；此页面仅在 Mock 模式显示。" />
      <Steps current={1} />
      <section className="card cashier-card">
        <div className="card-head">
          <div className="row">
            <ChannelIcon provider="alipay" />
            <h2>支付宝 Mock 收银台</h2>
          </div>
          <span className="badge amber">模拟交易</span>
        </div>
        <div className="pad" style={{ padding: 27 }}>
          <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>
            本次需支付
          </p>
          <div style={{ textAlign: "center", margin: "12px 0 25px" }}>
            <Money fen={opened.amountFen} />
          </div>
          <DetailList
            items={[
              ["商品名称", itemName(opened.subject)],
              ["订单编号", opened.outTradeNo, "mono"],
              ["订单金额", formatCny(opened.amountFen), "number-cell"],
              ["失效时间", formatTime(order.expiresAt)],
              ["接口方法", params.method ?? "—", "mono"],
            ]}
          />
          <div className="divider" />
          <Hint tone="green" icon="shield">
            商户请求的 RSA2 签名已用应用公钥验证通过。下方按钮会生成由“支付宝”私钥签名的异步通知，发送到本应用真实的通知接口。
          </Hint>
          <MockCashierClient orderId={order.id} returnUrl={returnUrl.toString()} />
        </div>
      </section>
    </>
  );
}
