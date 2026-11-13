import { InfoCard } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Chips";
import { Notice } from "@/components/ui/Notice";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { CHANNEL_LABELS } from "@/lib/store-pages/margin";
import { money, PAYOUT_STATUS, payableOf, saleState, type AccountView, type Balance } from "@/lib/store-pages/dashboard";
import type { PayoutRow, SaleRow } from "@/lib/store-pages/store";
import { PayoutButtons } from "./PayoutButtons";

/**
 * Payouts (09 screen 16 "Payouts table"; spec F-L5, F-L7; decision 0156): the brand's Stripe Connect account, what is
 * owed and what waits for delivery, the weekly payouts and every sale with its margin and state.
 */

const date = (iso: string | null): string => (iso === null ? "—" : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }));

export function AccountCard({ account, canManage, nextPayout }: Readonly<{ account: AccountView; canManage: boolean; nextPayout: string }>) {
  return (
    <div data-testid="payout-account">
      <InfoCard title="Stripe Connect" meta={<StatusPill tone={account.tone}>{account.pill}</StatusPill>}>
        <p className="text-body text-muted">{account.body}</p>
        {account.state === "active" ? <p className="text-body text-text-2">Payouts run every week, {nextPayout} next, for sales that have been delivered.</p> : null}
        {account.state === "unavailable" ? null : canManage ? (
          <PayoutButtons state={account.state} />
        ) : (
          <Notice tone="info">Only owners and admins set up payouts.</Notice>
        )}
      </InfoCard>
    </div>
  );
}

export function BalanceCards({ balances }: Readonly<{ balances: readonly Balance[] }>) {
  if (balances.length === 0) return null;
  return (
    <section aria-label="Balance" className="grid gap-4 md:grid-cols-2">
      {balances.map((balance) => (
        <div key={balance.currency} className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-bg p-5" data-testid={`balance-${balance.currency}`}>
          <div className="flex flex-col gap-1">
            <span className="text-small text-muted">Owed to you ({balance.currency})</span>
            <span className="text-h2 tabular-nums text-text">{money(balance.owedMinor, balance.currency)}</span>
            <span className="text-small text-muted">Delivered, not paid out yet.</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-small text-muted">Waiting for delivery</span>
            <span className="text-h2 tabular-nums text-text">{money(balance.heldMinor, balance.currency)}</span>
            <span className="text-small text-muted">{balance.undelivered === 1 ? "1 sale" : `${balance.undelivered} sales`} not delivered yet.</span>
          </div>
        </div>
      ))}
    </section>
  );
}

export function PayoutTable({ payouts }: Readonly<{ payouts: readonly PayoutRow[] }>) {
  if (payouts.length === 0) return <p className="rounded-xl border border-dashed border-border p-5 text-body text-muted">No payouts yet. The first one is made in the week after your first delivered sale.</p>;
  return (
    <Table caption="Payouts">
      <thead>
        <Tr>
          <Th>Date</Th>
          <Th numeric>Amount</Th>
          <Th>Status</Th>
        </Tr>
      </thead>
      <tbody>
        {payouts.map((payout) => (
          <Tr key={payout.id}>
            <Td>{date(payout.sentAt ?? payout.createdAt)}</Td>
            <Td numeric>{money(payout.amountMinor, payout.currency)}</Td>
            <Td>
              <StatusPill tone={PAYOUT_STATUS[payout.status].tone}>{PAYOUT_STATUS[payout.status].label}</StatusPill>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export function SalesTable({ sales, paidBySale }: Readonly<{ sales: readonly SaleRow[]; paidBySale: ReadonlyMap<string, number> }>) {
  if (sales.length === 0) return <p className="rounded-xl border border-dashed border-border p-5 text-body text-muted">No sales yet.</p>;
  return (
    <Table caption="Sales">
      <thead>
        <Tr>
          <Th>Date</Th>
          <Th>Product</Th>
          <Th>Channel</Th>
          <Th numeric>Retail</Th>
          <Th numeric>Your margin</Th>
          <Th>State</Th>
        </Tr>
      </thead>
      <tbody>
        {sales.map((sale) => {
          const state = saleState(sale, paidBySale.get(sale.id) ?? 0);
          return (
            <Tr key={sale.id}>
              <Td>{date(sale.soldAt)}</Td>
              <Td>
                {sale.productName} × {sale.quantity}
              </Td>
              <Td>{CHANNEL_LABELS[sale.channel]}</Td>
              <Td numeric>{money(sale.retailMinor, sale.currency)}</Td>
              <Td numeric>{money(payableOf(sale), sale.currency)}</Td>
              <Td>
                <StatusPill tone={state.tone}>{state.label}</StatusPill>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
