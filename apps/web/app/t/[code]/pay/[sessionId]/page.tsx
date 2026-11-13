import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { pageFrame } from "@/components/shell/page-width";
import { StoreTestPayButtons } from "@/components/team-stores/StoreTestPayButtons";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/factory/pricing";
import { payments, paymentsStore } from "@/lib/payments/server";
import { isTestSession } from "@/lib/payments/test-provider";
import { adminClient } from "@/lib/server/deps";
import { readBuyerPayment, readPublicStore } from "@/lib/team-stores/reads";
import { isStoreCode } from "@/lib/team-stores/rules";

/**
 * THE TEST CHECKOUT for a team store buyer (plan v6 C2 on C1's test checkout, decision 0153): where Stripe's page
 * would be, on a deploy with no Stripe keys and PAYMENTS_TEST_CHECKOUT on (the browser tests, a local run). A buyer
 * has no account, so this is the store's own public page; C1's member page cannot serve them. Anywhere else, and
 * for a checkout that is not this store's, the page does not exist.
 */
export const metadata: Metadata = { title: "Test checkout", robots: { index: false, follow: false } };

export default async function StoreTestCheckoutPage({ params }: PageProps<"/t/[code]/pay/[sessionId]">) {
  await connection();
  const { code, sessionId } = await params;
  if (payments()?.provider.name !== "test" || !isTestSession(sessionId) || !isStoreCode(code)) notFound();
  const [payment, loaded] = await Promise.all([paymentsStore().paymentBySession(sessionId), readPublicStore(adminClient(), code)]);
  const owned = payment && loaded ? await readBuyerPayment(adminClient(), loaded.store.id, payment.id) : null;
  if (!payment || !loaded || !owned) notFound();

  return (
    <>
      <PublicHeader linkHome={false} width="form" />
      <main id="main" className={`${pageFrame("form")} flex flex-col gap-6 py-10`}>
        <p className="text-small text-muted">Test checkout</p>
        <h1 className="text-h1 text-text">{payment.description}</h1>
        <p className="text-body-lg text-text-2">{formatMoney(payment.amountMinor, payment.currency)}</p>
        <Notice tone="info">This is the test checkout. No card is charged and no money moves. On a deploy with Stripe set up, this is Stripe&apos;s own page.</Notice>
        {payment.status === "open" ? (
          <StoreTestPayButtons code={code} sessionId={sessionId} />
        ) : (
          <Notice tone="warn" role="alert">
            This checkout is already {payment.status === "expired" ? "closed" : "paid"}.
          </Notice>
        )}
      </main>
    </>
  );
}
