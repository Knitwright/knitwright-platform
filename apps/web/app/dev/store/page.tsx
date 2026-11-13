import { Plug } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { BrandingCards, StorefrontLook } from "@/components/store-pages/BrandingView";
import { ChannelsPanel } from "@/components/store-pages/ChannelsSlot";
import { MarginCalculator } from "@/components/store-pages/MarginCalculator";
import { LiabilityCards } from "@/components/store-pages/OpsPayouts";
import { OverviewCards, OverviewTiles, TopProducts } from "@/components/store-pages/OverviewView";
import { AccountCard, BalanceCards, PayoutTable, SalesTable } from "@/components/store-pages/PayoutsView";
import { SettingsView } from "@/components/store-pages/SettingsView";
import { StoreHeader } from "@/components/store-pages/StoreHeader";
import { StoreLoading } from "@/components/store-pages/StoreLoading";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { gbRates, jerseyLadder } from "@/lib/collections/fixtures/plan";
import { accountView, balancesOf, overviewOf } from "@/lib/store-pages/dashboard";
import { account, MONTH_OF_SALES, payout } from "@/lib/store-pages/fixtures/store";
import { BRANDING_PATH, CHANNELS_PATH, PAYOUTS_PATH, SETTINGS_PATH, STORE_PATH } from "@/lib/store-pages/routes";
import { EMPTY_SETTINGS, type BrandingOption } from "@/lib/store-pages/settings";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Store fixture", robots: { index: false, follow: false } };

/**
 * The Store tabs with made-up data (plan v6 C5, decision 0156), for the 1440 × 900 comparison with p14, p15, p17 and
 * p18 without a database. `?view=` picks one: overview (default), overview-empty, channels, branding, settings,
 * payouts, payouts-none, ops, loading. Buttons that would save do nothing useful here: there is no session.
 */

const NOW = new Date("2026-11-13T12:00:00.000Z");
const NEXT = "Friday 20 Nov";

const OPTIONS: readonly BrandingOption[] = [
  { id: "packing_inserts", name: "Packing inserts", description: "A6 card in every parcel: thank-you note, crest, QR to your store.", costFromMinor: 30, currency: "GBP", per: "order", details: "Insert size: A6 · Print: both sides", isPlaceholder: true },
  { id: "neck_labels", name: "Neck labels", description: "Your crest and size printed inside the neck, instead of a scratchy tag.", costFromMinor: 40, currency: "GBP", per: "item", details: "Print: inside neck · 1 colour", isPlaceholder: true },
  { id: "hang_tags", name: "Hang tags", description: "Card tag on a string with your crest, price and care info.", costFromMinor: 35, currency: "GBP", per: "item", details: "Size: 50 × 90 mm", isPlaceholder: true },
  { id: "gift_messages", name: "Gift messages", description: "Let buyers add a printed note for a player, parent or coach.", costFromMinor: null, currency: "GBP", per: null, details: "Up to 200 characters", isPlaceholder: true },
];

const CALCULATOR = {
  articles: [{ code: "JSY-SS-01", name: "Short-sleeve jersey", ladder: jerseyLadder }],
  markets: [{ country: "GB", name: "United Kingdom", currency: "GBP" as const, rates: { "JSY-SS-01": gbRates } }],
  fees: [{ channel: "storefront" as const, currency: "GBP" as const, percentBps: 150, fixedMinor: 20, label: "Placeholder", isPlaceholder: true }],
  knitwrightFeeBps: 0,
};

export default async function DevStorePage({ searchParams }: PageProps<"/dev/store">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const view = (await searchParams).view;
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Lahore Lions", workspace: { isClub: true, setUp: true }, credits: 1240 }}>
      <Body view={typeof view === "string" ? view : "overview"} />
    </AppShell>
  );
}

function Overview({ empty }: Readonly<{ empty: boolean }>) {
  const sales = empty ? [] : MONTH_OF_SALES;
  const overview = overviewOf(sales, NOW);
  const balances = balancesOf(sales, new Map());
  return (
    <div className="flex flex-col gap-8 pb-16">
      <StoreHeader
        title="Store"
        current={STORE_PATH}
        actions={
          <LinkButton href={CHANNELS_PATH} variant="secondary" icon={<Icon icon={Plug} size={16} />}>
            Connect a sales channel
          </LinkButton>
        }
      />
      <OverviewTiles overview={overview} balances={balances} nextPayout={NEXT} />
      <OverviewCards brandName="Lahore Lions" overview={overview} balances={balances} account={accountView(empty ? null : account(), true)} nextPayout={NEXT} />
      <h2 className="text-h3 text-text">Top products</h2>
      <TopProducts overview={overview} />
      <h2 className="text-h3 text-text">Margin calculator</h2>
      <MarginCalculator {...CALCULATOR} />
    </div>
  );
}

function Body({ view }: Readonly<{ view: string }>) {
  switch (view) {
    case "loading":
      return <StoreLoading />;
    case "channels":
      return (
        <div className="flex flex-col gap-8">
          <StoreHeader title="Sales channels" current={CHANNELS_PATH} />
          <ChannelsPanel />
        </div>
      );
    case "branding":
      return (
        <div className="flex flex-col gap-6">
          <StoreHeader title="Branding" current={BRANDING_PATH} />
          <StorefrontLook />
          <BrandingCards options={OPTIONS} settings={{ ...EMPTY_SETTINGS, branding: { neck_labels: { on: true, note: "Crest and size" } } }} canManage />
        </div>
      );
    case "settings":
      return (
        <div className="flex flex-col gap-6">
          <StoreHeader title="Store settings" current={SETTINGS_PATH} />
          <SettingsView initial={EMPTY_SETTINGS} canManage euReady={false} />
        </div>
      );
    case "payouts":
    case "payouts-none":
      return (
        <div className="flex flex-col gap-8">
          <StoreHeader title="Payouts" current={PAYOUTS_PATH} />
          <AccountCard account={accountView(view === "payouts" ? account() : null, true)} canManage nextPayout={NEXT} />
          <BalanceCards balances={view === "payouts" ? balancesOf(MONTH_OF_SALES, new Map()) : []} />
          <PayoutTable payouts={view === "payouts" ? [payout(), payout({ id: "00000000-0000-4000-8000-0000000000a2", status: "sent", amountMinor: 30400, paidAt: null })] : []} />
          <SalesTable sales={view === "payouts" ? MONTH_OF_SALES : []} paidBySale={new Map()} />
        </div>
      );
    case "ops":
      return <LiabilityCards liability={[{ currency: "GBP", heldMinor: 1500, owedMinor: 4656, inFlightMinor: 30400, undeliveredSales: 1 }, { currency: "AUD", heldMinor: 0, owedMinor: 0, inFlightMinor: 0, undeliveredSales: 0 }]} />;
    default:
      return <Overview empty={view === "overview-empty"} />;
  }
}
