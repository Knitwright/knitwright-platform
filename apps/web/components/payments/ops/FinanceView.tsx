import { formatMoney } from "@/lib/factory/pricing";
import { figureLines, type FinanceFigures } from "@/lib/payments/controls";
import { refundable } from "@/lib/payments/refunds";
import type { PaymentRow } from "@/lib/payments/store";
import { amountLine } from "@/lib/payments/view";
import { RefundForm } from "./FinanceForms";

/** The F-G4 figures of one currency (decision 0152): GMV and revenue on lines of their own, never added together. */
export function FigureCard({ figures }: Readonly<{ figures: FinanceFigures }>) {
  return (
    <section aria-labelledby={`figures-${figures.currency}`} className="flex flex-col gap-3 rounded-md border border-border p-4" data-testid={`finance-${figures.currency}`}>
      <h3 id={`figures-${figures.currency}`} className="text-h3 text-text">
        {figures.currency}
      </h3>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_max-content_1fr]">
        {figureLines(figures).map((line) => (
          <div key={line.id} className="contents" data-testid={`figure-${line.id}`}>
            <dt className="text-body font-semibold text-text">{line.label}</dt>
            <dd className="text-body tabular-nums text-text">{line.value}</dd>
            <dd className="text-small text-muted">{line.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The newest payments, with a refund form on each one that still has something to give back. */
export function PaymentList({ payments }: Readonly<{ payments: readonly PaymentRow[] }>) {
  if (payments.length === 0) return <p className="text-body text-muted">No payments yet.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label="Payments">
      {payments.map((payment) => {
        const left = refundable(payment);
        return (
          <li key={payment.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-body font-semibold text-text">{payment.description}</span>
              <span className="text-small text-muted">
                {payment.status} · {payment.method} · {payment.createdAt.slice(0, 10)}
              </span>
            </div>
            <p className="text-small text-muted">
              {amountLine(payment)}
              {payment.refundedMinor > 0 ? ` Refunded ${formatMoney(payment.refundedMinor, payment.currency)}.` : ""}
            </p>
            {left > 0 ? <RefundForm paymentId={payment.id} leftMinor={left} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
