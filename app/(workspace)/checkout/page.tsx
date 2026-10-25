import { requireSession } from "@/lib/auth/session";
import { TEST_ITEM } from "@/lib/catalog";
import { formatCny } from "@/lib/ui";
import CheckoutClient from "@/components/CheckoutClient";

export default async function Checkout() {
  await requireSession();
  return (
    <>
      <h1>Checkout</h1>
      <section className="card">
        <dl className="kv">
          <dt>Item</dt>
          <dd>{TEST_ITEM.subject}</dd>
          <dt>Amount</dt>
          <dd>{formatCny(TEST_ITEM.amountFen)}</dd>
        </dl>
      </section>
      <section className="card">
        <h2>Choose a payment method</h2>
        <CheckoutClient />
      </section>
    </>
  );
}
