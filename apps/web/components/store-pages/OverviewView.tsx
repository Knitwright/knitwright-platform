import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { InfoCard } from "@/components/ui/Card";
import { StatusPill, type Tone } from "@/components/ui/Chips";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { money, type AccountView, type Balance, type Overview } from "@/lib/store-pages/dashboard";
import { CHANNELS_PATH, NEW_DROP_HREF, PAYOUTS_PATH, STOREFRONT_EDITOR_HREF, TEAM_STORES_HREF } from "@/lib/store-pages/routes";

/**
 * The seller dashboard (09 screen 16, prototype p14; spec F-L7): this month's sales, margin and orders, the cards of
 * the storefront, drops, team stores, channels and payouts, and the products that earn the most. Cards whose screens
 * other Store workstreams build (C2, C3) say so until their one-line door in `routes.ts` is set.
 */

export type OverviewProps = Readonly<{
  brandName: string;
  overview: Overview;
  balances: readonly Balance[];
  account: AccountView;
  nextPayout: string;
}>;

function Tile({ label, value, note, testId }: Readonly<{ label: string; value: string; note: string; testId: string }>) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-bg p-5" data-testid={testId}>
      <span className="text-small font-medium text-muted">{label}</span>
      <span className="text-h2 tabular-nums text-text">{value}</span>
      <span className="text-small text-muted">{note}</span>
    </div>
  );
}

function StoreCard({ title, pill, tone = "neutral", children, testId }: Readonly<{ title: string; pill: string; tone?: Tone; children: ReactNode; testId: string }>) {
  return (
    <div data-testid={testId}>
      <InfoCard title={title} meta={<StatusPill tone={tone}>{pill}</StatusPill>} className="h-full">
        <div className="flex flex-col gap-3 text-body text-muted">{children}</div>
      </InfoCard>
    </div>
  );
}

const TextLink = ({ href, children }: Readonly<{ href: Route; children: ReactNode }>) => (
  <Link href={href} className="w-fit text-small font-semibold text-link">
    {children}
  </Link>
);

/** A card for a screen another Store workstream builds: a link when its door is set, an honest line until then. */
function DoorCard({ title, href, ready, waiting, action, testId }: Readonly<{ title: string; href: Route | null; ready: string; waiting: string; action: string; testId: string }>) {
  return (
    <StoreCard title={title} pill={href ? "Open" : "Coming soon"} tone={href ? "info" : "neutral"} testId={testId}>
      <p>{href ? ready : waiting}</p>
      {href ? <TextLink href={href}>{action}</TextLink> : null}
    </StoreCard>
  );
}

export function OverviewTiles({ overview, balances, nextPayout }: Readonly<Pick<OverviewProps, "overview" | "balances" | "nextPayout">>) {
  const owed = balances.find((balance) => balance.currency === overview.currency);
  return (
    <section aria-label="This month" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile testId="tile-sales" label="Sales this month" value={money(overview.salesMinor, overview.currency)} note="What buyers paid, less refunds." />
      <Tile testId="tile-margin" label="Your margin this month" value={money(overview.marginMinor, overview.currency)} note="Retail less base, freight, duty and fees." />
      <Tile testId="tile-orders" label="Orders this month" value={String(overview.orders)} note={overview.refunds === 0 ? "No refunds." : `${overview.refunds} with a refund.`} />
      <Tile testId="tile-owed" label="Owed to you" value={money(owed?.owedMinor ?? 0, overview.currency)} note={`Next payout run ${nextPayout}.`} />
    </section>
  );
}

export function OverviewCards({ brandName, overview, balances, account, nextPayout }: OverviewProps) {
  const owed = balances.find((balance) => balance.currency === overview.currency)?.owedMinor ?? 0;
  return (
    <section aria-label="Your store" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <DoorCard
        testId="card-storefront"
        title="Storefront"
        href={STOREFRONT_EDITOR_HREF}
        ready={`${brandName}'s storefront, themed from your brand kit.`}
        waiting="Your own storefront, themed from your brand kit, opens with storefronts. Sales made there show up here."
        action="Edit storefront"
      />
      <DoorCard
        testId="card-drops"
        title="Drops"
        href={NEW_DROP_HREF}
        ready="Pre-order windows that ship as one batch at close."
        waiting="Pre-order drops that ship as one batch at close open with storefronts."
        action="Your drops"
      />
      <DoorCard
        testId="card-team-stores"
        title="Team stores"
        href={TEAM_STORES_HREF}
        ready="Players pick sizes, names and numbers, pay, and it ships as one batch."
        waiting="Hosted club stores, with a club margin, open with team stores."
        action="Your team stores"
      />
      <StoreCard testId="card-channels" title="Sales channels" pill="Shopify and more">
        <p>Sell through Shopify and other channels. Knitwright makes and ships every order.</p>
        <TextLink href={CHANNELS_PATH}>See sales channels</TextLink>
      </StoreCard>
      <StoreCard testId="card-payouts" title="Payouts" pill={account.state === "active" && owed > 0 ? `${money(owed, overview.currency)} ${nextPayout}` : account.pill} tone={account.state === "active" ? "ok" : account.tone}>
        <p>{account.body}</p>
        <TextLink href={PAYOUTS_PATH}>{account.state === "active" ? "See payouts" : "Set up payouts"}</TextLink>
      </StoreCard>
    </section>
  );
}

export function TopProducts({ overview }: Readonly<{ overview: Overview }>) {
  if (overview.top.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-5 text-body text-muted">No sales yet. When buyers order from your storefront, drops or team stores, your best products show here.</p>;
  }
  return (
    <Table caption="Top products by margin">
      <thead>
        <Tr>
          <Th>Product</Th>
          <Th numeric>Units</Th>
          <Th numeric>Sales</Th>
          <Th numeric>Your margin</Th>
        </Tr>
      </thead>
      <tbody>
        {overview.top.map((line) => (
          <Tr key={line.name}>
            <Td>{line.name}</Td>
            <Td numeric>{line.units}</Td>
            <Td numeric>{money(line.salesMinor, overview.currency)}</Td>
            <Td numeric>{money(line.marginMinor, overview.currency)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
