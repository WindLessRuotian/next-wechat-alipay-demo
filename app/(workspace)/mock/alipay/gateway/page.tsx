import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { fenToYuan } from "@/lib/money";
import { openMockCashier } from "@/lib/mock/alipay-provider";
import { getOrderByOutTradeNo } from "@/lib/payments/orders";
import MockCashierClient from "@/components/MockCashierClient";

/**
 * MOCK Alipay cashier (stands in for …/gateway.do?method=alipay.trade.page.pay…).
 * It verifies the merchant's RSA2 request signature with the app public key,
 * exactly as Alipay would, before showing anything.
 */
export default async function MockCashier({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (env().alipayMode !== "mock") notFound();
  const params = await searchParams;
  const opened = await openMockCashier(params);
  if (!opened.ok) return <p className="alert error">Mock Alipay rejected the request: {opened.error}</p>;

  const session = await getSession();
  const order = await getOrderByOutTradeNo("alipay", opened.outTradeNo);
  if (!session || !order || order.userId !== session.user.id) return <p className="alert error">Unknown order.</p>;

  const returnUrl = new URL(params.return_url ?? `${env().APP_URL}/orders`);
  returnUrl.searchParams.set("out_trade_no", opened.outTradeNo);
  returnUrl.searchParams.set("total_amount", fenToYuan(opened.amountFen));

  return (
    <>
      <h1>Mock Alipay cashier</h1>
      <p className="muted">Merchant request signature verified ✓ · method {params.method}</p>
      <section className="card">
        <dl className="kv">
          <dt>Subject</dt>
          <dd>{opened.subject}</dd>
          <dt>Amount</dt>
          <dd>¥{fenToYuan(opened.amountFen)}</dd>
          <dt>out_trade_no</dt>
          <dd className="mono">{opened.outTradeNo}</dd>
        </dl>
      </section>
      <MockCashierClient orderId={order.id} returnUrl={returnUrl.toString()} />
    </>
  );
}
