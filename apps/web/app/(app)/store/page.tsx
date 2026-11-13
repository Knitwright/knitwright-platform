import { Plug, Plus } from "lucide-react";
import type { Metadata } from "next";
import { MarginCalculator } from "@/components/store-pages/MarginCalculator";
import { OverviewCards, OverviewTiles, TopProducts } from "@/components/store-pages/OverviewView";
import { StoreHeader } from "@/components/store-pages/StoreHeader";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { accountView, balancesOf, dayLabel, nextPayoutDate, overviewOf } from "@/lib/store-pages/dashboard";
import { loadCalculator, loadPayoutsData } from "@/lib/store-pages/read";
import { CHANNELS_PATH, NEW_DROP_HREF, STORE_PATH } from "@/lib/store-pages/routes";
import { connect } from "@/lib/store-pages/server";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Store" };

/**
 * Store › Overview, the seller dashboard (plan v6 C5, decision 0156; 09 screen 16, prototype p14; spec F-L7): this
 * month's sales, margin and orders, the store's cards, the products that earn the most and the margin calculator.
 */
export default async function StorePage() {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const [data, calculator] = await Promise.all([loadPayoutsData(client, brand.id), loadCalculator(client)]);
  const now = new Date();
  const overview = overviewOf(data.sales, now);
  const nextPayout = dayLabel(nextPayoutDate(now));
  const drop = NEW_DROP_HREF;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <StoreHeader
        title="Store"
        current={STORE_PATH}
        actions={
          <>
            <LinkButton href={CHANNELS_PATH} variant="secondary" icon={<Icon icon={Plug} size={16} />}>
              Connect a sales channel
            </LinkButton>
            {drop ? (
              <LinkButton href={drop} icon={<Icon icon={Plus} size={16} />}>
                New drop
              </LinkButton>
            ) : null}
          </>
        }
      />
      <OverviewTiles overview={overview} balances={balancesOf(data.sales, data.paidBySale)} nextPayout={nextPayout} />
      <OverviewCards brandName={brand.name} overview={overview} balances={balancesOf(data.sales, data.paidBySale)} account={accountView(data.account, connect() !== null)} nextPayout={nextPayout} />
      <section aria-labelledby="top-products" className="flex flex-col gap-3">
        <h2 id="top-products" className="text-h3 text-text">
          Top products
        </h2>
        <TopProducts overview={overview} />
      </section>
      <section aria-labelledby="margin" className="flex flex-col gap-3">
        <h2 id="margin" className="text-h3 text-text">
          Margin calculator
        </h2>
        <p className="text-body text-muted">Your profit per unit at a retail price: base price, freight, duty and fees taken off.</p>
        <MarginCalculator articles={calculator.articles} markets={calculator.markets} fees={calculator.fees} knitwrightFeeBps={calculator.knitwrightFeeBps} />
      </section>
    </div>
  );
}
