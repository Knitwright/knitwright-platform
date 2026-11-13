import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TestCheckoutButtons } from "@/components/payments/TestCheckoutButtons";
import { PageIntro } from "@/components/shell/PageIntro";
import { Notice } from "@/components/ui/Notice";
import { payments } from "@/lib/payments/server";
import { PAYMENT_COLUMNS, toPayment } from "@/lib/payments/store";
import { isTestSession } from "@/lib/payments/test-provider";
import { amountLine } from "@/lib/payments/view";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false, follow: false } };

/**
 * THE TEST CHECKOUT (plan v6 C1, decision 0152): where Stripe's page would be, on a deploy with no Stripe keys and
 * PAYMENTS_TEST_CHECKOUT on (the browser tests, a local run). Anywhere else, and for a checkout of another brand,
 * the page does not exist. The payment is read with the member's own client, so the database decides who sees it.
 */
export default async function TestCheckoutPage({ params }: PageProps<"/checkout/test/[sessionId]">) {
  await requireMember();
  const { sessionId } = await params;
  if (payments()?.provider.name !== "test" || !isTestSession(sessionId)) notFound();
  const { data } = await (await sessionClient()).from("order_payments").select(PAYMENT_COLUMNS).eq("provider_session_id", sessionId).maybeSingle();
  if (!data) notFound();
  const payment = toPayment(data);

  return (
    <main id="main" className="flex flex-col">
      <div className="flex max-w-2xl flex-col gap-6">
        <PageIntro eyebrow="Test checkout" title={payment.description} lead={amountLine(payment)} />
        <Notice tone="info">This is the test checkout. No card is charged and no money moves. On a deploy with Stripe set up, this is Stripe&apos;s own page.</Notice>
        {payment.status === "open" ? (
          <TestCheckoutButtons sessionId={sessionId} />
        ) : (
          <Notice tone="warn" role="alert">
            This checkout is already {payment.status === "expired" ? "closed" : "paid"}.
          </Notice>
        )}
      </div>
    </main>
  );
}
