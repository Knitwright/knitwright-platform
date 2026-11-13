import type { Metadata } from "next";
import { DepositForm, PaymentSettingsForm } from "@/components/payments/ops/FinanceForms";
import { FigureCard, PaymentList } from "@/components/payments/ops/FinanceView";
import { LiabilityCards, RunPayouts, WaitingSales } from "@/components/store-pages/OpsPayouts";
import { loadFinance } from "@/lib/payments/ops-read";
import { percentOf } from "@/lib/payments/amounts";
import { loadPayoutsOps } from "@/lib/store-pages/ops-read";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: finance", robots: { index: false, follow: false } };

/**
 * F-G4 financial controls (plan v6 C1, decision 0152). Platform admins only. GMV and revenue reported apart; factory
 * deposits recorded here and refused by the database above collected cash less the refund reserve; the reserve
 * and the deposit rule as settings; the newest payments with refunds.
 */
export default async function OpsFinancePage() {
  const session = await requirePlatformAdmin();
  const client = await sessionClient();
  const [view, payouts] = await Promise.all([loadFinance(client, adminClient(), session.userId), loadPayoutsOps(client, adminClient(), session.userId)]);
  return (
    <main id="main" className="rise flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Finance</h1>
        <p className="mt-2 text-[15px] text-muted">
          Factory deposits never exceed collected cash less a refund reserve of {percentOf(view.settings.refundReserveBps)} of open pre-orders. Settings: {view.settings.label}
          {view.settings.isPlaceholder ? " (placeholder until the owner sets them)." : "."}
        </p>
      </header>
      <section aria-labelledby="figures" className="flex flex-col gap-3">
        <h2 id="figures" className="text-h3 text-text">
          GMV, revenue and the deposit headroom
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {view.figures.map((figures) => (
            <FigureCard key={figures.currency} figures={figures} />
          ))}
        </div>
      </section>
      {/* Plan v6 C5 (decision 0156): what Knitwright holds that is the sellers', reported apart from the figures above. */}
      <section aria-labelledby="seller-payouts" className="flex flex-col gap-3">
        <h2 id="seller-payouts" className="text-h3 text-text">
          Seller payouts
        </h2>
        <p className="text-body text-muted">Sellers are paid weekly for delivered sales: their margin less refunds, less what earlier payouts paid.</p>
        <LiabilityCards liability={payouts.liability} />
        <RunPayouts />
        <h3 className="text-body font-semibold text-text">Waiting for delivery</h3>
        <WaitingSales sales={payouts.waiting} />
      </section>
      <section aria-labelledby="deposit" className="flex flex-col gap-3">
        <h2 id="deposit" className="text-h3 text-text">
          Record a factory deposit
        </h2>
        <DepositForm />
      </section>
      <section aria-labelledby="settings" className="flex flex-col gap-3">
        <h2 id="settings" className="text-h3 text-text">
          Payment settings
        </h2>
        <PaymentSettingsForm settings={view.settings} />
      </section>
      <section aria-labelledby="payments" className="flex flex-col gap-3">
        <h2 id="payments" className="text-h3 text-text">
          Payments
        </h2>
        <PaymentList payments={view.payments} />
      </section>
    </main>
  );
}
