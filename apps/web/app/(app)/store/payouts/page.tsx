import type { Metadata } from "next";
import { AccountCard, BalanceCards, PayoutTable, SalesTable } from "@/components/store-pages/PayoutsView";
import { StoreHeader } from "@/components/store-pages/StoreHeader";
import { Notice } from "@/components/ui/Notice";
import { can } from "@/lib/clubs/roles";
import { accountView, balancesOf, dayLabel, nextPayoutDate } from "@/lib/store-pages/dashboard";
import { loadPayoutsData } from "@/lib/store-pages/read";
import { PAYOUTS_PATH } from "@/lib/store-pages/routes";
import { connect } from "@/lib/store-pages/server";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Payouts" };

/**
 * Store › Payouts (plan v6 C5, decision 0156; spec F-L5 "paid out weekly after delivery confirmation via Stripe
 * Connect Express"): the brand's Connect account, its balance, its weekly payouts and every sale.
 */
export default async function StorePayoutsPage({ searchParams }: PageProps<"/store/payouts">) {
  const { brand } = await requireMember();
  const back = (await searchParams).onboarding;
  const data = await loadPayoutsData(await sessionClient(), brand.id);
  const account = accountView(data.account, connect() !== null);
  const nextPayout = dayLabel(nextPayoutDate(new Date()));
  return (
    <div className="flex flex-col gap-8 pb-16">
      <StoreHeader title="Payouts" current={PAYOUTS_PATH} />
      {back === "back" && account.state !== "active" ? <Notice tone="info">Stripe has not finished checking your details yet. This page updates when it has.</Notice> : null}
      {back === "back" && account.state === "active" ? <Notice tone="ok">Payouts are set up. Your margin is paid weekly after delivery.</Notice> : null}
      <AccountCard account={account} canManage={can(brand.role, "manageMembers")} nextPayout={nextPayout} />
      <BalanceCards balances={balancesOf(data.sales, data.paidBySale)} />
      <section aria-labelledby="payouts" className="flex flex-col gap-3">
        <h2 id="payouts" className="text-h3 text-text">
          Payouts
        </h2>
        <PayoutTable payouts={data.payouts} />
      </section>
      <section aria-labelledby="sales" className="flex flex-col gap-3">
        <h2 id="sales" className="text-h3 text-text">
          Sales
        </h2>
        <p className="text-body text-muted">Each sale pays its margin once it is delivered. A refund after a payout is taken off the next one.</p>
        <SalesTable sales={data.sales} paidBySale={data.paidBySale} />
      </section>
    </div>
  );
}
