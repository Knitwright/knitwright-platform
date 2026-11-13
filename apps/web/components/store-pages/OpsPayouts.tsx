"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/factory/pricing";
import { confirmSaleDeliveredAction, runSellerPayoutsAction } from "@/lib/store-pages/actions";
import type { Liability } from "@/lib/store-pages/ops-read";
import type { SaleRow } from "@/lib/store-pages/store";

/**
 * Seller payouts on /ops/finance (plan v6 C5, decision 0156; F-G4 "every payout is reconciled against delivered
 * orders"): what Knitwright holds that is the sellers', per currency, beside C1's figures and never added to them;
 * the weekly run, pressable by hand; and the newest sales waiting for delivery, which ops may confirm.
 */

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const run = (act: () => Promise<Readonly<{ success: true; data: unknown } | { success: false; error: Readonly<{ message: string }> }>>, done: (data: unknown) => string) =>
    start(async () => {
      const reply = await act().catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "Not sent. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: done(reply.data) });
      router.refresh();
    });
  return { pending, note, run };
}

const Said = ({ note }: Readonly<{ note: Readonly<{ tone: "ok" | "warn"; text: string }> | null }>) =>
  note ? (
    <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
      {note.text}
    </Notice>
  ) : null;

export function LiabilityCards({ liability }: Readonly<{ liability: readonly Liability[] }>) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {liability.map((one) => {
        const money = (minor: number) => formatMoney(minor, one.currency);
        return (
          <section key={one.currency} aria-label={`Seller payouts ${one.currency}`} className="flex flex-col gap-3 rounded-md border border-border p-4" data-testid={`liability-${one.currency}`}>
            <h3 className="text-h3 text-text">{one.currency}</h3>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_max-content_1fr]">
              <dt className="text-body font-semibold text-text">Owed to sellers</dt>
              <dd className="text-body tabular-nums text-text">{money(one.owedMinor)}</dd>
              <dd className="text-small text-muted">Delivered sales not paid out yet, and payouts prepared but not sent.</dd>
              <dt className="text-body font-semibold text-text">Held until delivery</dt>
              <dd className="text-body tabular-nums text-text">{money(one.heldMinor)}</dd>
              <dd className="text-small text-muted">The margin of {one.undeliveredSales} sales not delivered yet.</dd>
              <dt className="text-body font-semibold text-text">On its way</dt>
              <dd className="text-body tabular-nums text-text">{money(one.inFlightMinor)}</dd>
              <dd className="text-small text-muted">Sent to sellers&apos; Stripe accounts, not yet in their banks.</dd>
            </dl>
          </section>
        );
      })}
    </div>
  );
}

export function RunPayouts() {
  const { pending, note, run } = useRun();
  return (
    <div className="flex flex-col gap-2">
      <Said note={note} />
      <div>
        <Button variant="secondary" pending={pending} onClick={() => run(() => runSellerPayoutsAction({}), (data) => (data as { message: string }).message)} data-testid="run-seller-payouts">
          Run this week&apos;s payouts now
        </Button>
      </div>
    </div>
  );
}

export function WaitingSales({ sales }: Readonly<{ sales: readonly SaleRow[] }>) {
  const { pending, note, run } = useRun();
  return (
    <div className="flex flex-col gap-3">
      <Said note={note} />
      {sales.length === 0 ? <p className="text-body text-muted">No sale is waiting for delivery.</p> : null}
      <ul hidden={sales.length === 0} className="flex flex-col gap-2" aria-label="Sales waiting for delivery">
        {sales.map((sale) => (
          <li key={sale.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="text-body text-text">
              {sale.productName} × {sale.quantity} · {formatMoney(sale.marginMinor, sale.currency)} margin · {sale.sourceRef} · sold {sale.soldAt.slice(0, 10)}
            </span>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => confirmSaleDeliveredAction({ saleId: sale.id }), () => "Marked delivered. It pays out at the next run.")}>
              Mark delivered
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
