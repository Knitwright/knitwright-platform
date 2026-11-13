"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/factory/pricing";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { startCreditCheckoutAction } from "@/lib/payments/actions";
import type { CreditPack } from "@/lib/payments/billing";

/**
 * Get more credits (09 screen 19; plan v6 C1, decision 0152): a pack is a card checkout, and its credits land in the
 * ledger when Stripe says it is paid. Only owners and admins buy; anyone else is told so.
 */
export function BuyCredits({ packs, canBuy, label }: Readonly<{ packs: readonly CreditPack[]; canBuy: boolean; label: string }>) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const buy = (packId: string) => {
    setChosen(packId);
    setProblem(null);
    start(async () => {
      const reply = await startCreditCheckoutAction({ packId }).catch(() => null);
      if (!reply) return setProblem("The checkout could not be opened. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      window.location.assign(reply.data.url);
    });
  };

  if (packs.length === 0) return <p className="text-body text-muted">No credit packs are on sale yet.</p>;

  return (
    <div className="flex flex-col gap-3" data-testid="buy-credits">
      <ul className="grid gap-3 sm:grid-cols-3">
        {packs.map((pack) => (
          <li key={pack.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
            <span className="text-h3 text-text">{pack.credits.toLocaleString("en-GB")} credits</span>
            <span className="text-body text-muted">{formatMoney(pack.priceMinor, "GBP")}</span>
            <Button
              variant="premium"
              size="sm"
              pending={pending && chosen === pack.id}
              disabledReason={canBuy ? undefined : "Only owners and admins buy credits."}
              onClick={() => buy(pack.id)}
            >
              Buy
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-small text-muted">{label}</p>
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
    </div>
  );
}
