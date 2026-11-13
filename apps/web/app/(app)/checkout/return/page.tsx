import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/shell/PageIntro";
import { LinkButton } from "@/components/ui/LinkButton";
import { Notice } from "@/components/ui/Notice";
import { LINE_COLUMNS, PAYMENT_COLUMNS, toLine, toPayment } from "@/lib/payments/store";
import { amountLine, headlineOf, lineSummary, nextPlaceOf } from "@/lib/payments/view";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where Stripe (or the test checkout) sends the person back (plan v6 C1, decision 0152). It reads the payment with
 * the member's own client and says where it stands: paid and sent, waiting for Stripe's word, cancelled, or
 * refunded. Nothing here changes a payment; only the webhook does.
 */
export default async function CheckoutReturnPage({ searchParams }: PageProps<"/checkout/return">) {
  await requireMember();
  const query = await searchParams;
  const id = typeof query.payment === "string" && UUID.test(query.payment) ? query.payment : null;
  if (id === null) notFound();
  const client = await sessionClient();
  const [{ data }, { data: lineRows }] = await Promise.all([
    client.from("order_payments").select(PAYMENT_COLUMNS).eq("id", id).maybeSingle(),
    client.from("order_payment_lines").select(LINE_COLUMNS).eq("payment_id", id).order("request_key"),
  ]);
  if (!data) notFound();
  const payment = toPayment(data);
  const lines = (lineRows ?? []).map(toLine);
  const headline = headlineOf(payment, query.cancelled === "1", lines);
  const next = nextPlaceOf(payment);

  return (
    <main id="main" className="flex flex-col" data-testid="checkout-return">
      <div className="flex max-w-2xl flex-col gap-6">
        <PageIntro eyebrow={payment.description} title={headline.title} lead={amountLine(payment)} />
        <Notice tone={headline.tone} role={headline.tone === "warn" ? "alert" : "status"}>
          {headline.body}
        </Notice>
        {lines.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Orders in this payment">
            {lines.map((line) => {
              const summary = lineSummary(line);
              return (
                <li key={line.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-4 py-3 text-body">
                  <span className="text-text">{summary.label}</span>
                  <span className="text-muted">{summary.state}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {headline.waiting ? (
            <LinkButton href={`/checkout/return?payment=${payment.id}` as Route} variant="secondary">
              Check again
            </LinkButton>
          ) : null}
          <LinkButton href={next.href as Route}>{next.label}</LinkButton>
        </div>
      </div>
    </main>
  );
}
