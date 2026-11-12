import { Factory, Plus } from "lucide-react";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import type { TierDiscount } from "@/lib/order-desk/discounts";
import { OrdersTabs } from "./OrdersTabs";

/**
 * The top of every Orders tab (p09): the title with its actions, the team and bulk discount banner,
 * the settings strip and the four tabs. The page's own content follows.
 */
export function OrdersArea({ current, discounts, children }: Readonly<{ current: Route; discounts: readonly TierDiscount[]; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-5 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-text">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/orders/runs" variant="secondary" icon={<Icon icon={Factory} size={16} />}>
            Product runs
          </LinkButton>
          <LinkButton href={"/orders/runs#builder" as Route} icon={<Icon icon={Plus} size={16} />}>
            Create order
          </LinkButton>
        </div>
      </header>
      <DiscountBanner discounts={discounts} />
      <SettingsStrip />
      <OrdersTabs current={current} />
      {children}
    </div>
  );
}

/** "Save on team and bulk orders", with one box per price tier the factory gives a saving at. */
function DiscountBanner({ discounts }: Readonly<{ discounts: readonly TierDiscount[] }>) {
  return (
    <section aria-labelledby="bulk-discounts" className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-info-soft px-7 py-6">
      <div className="flex max-w-xl flex-col gap-2">
        <h2 id="bulk-discounts" className="text-h3 text-text">Save on team and bulk orders</h2>
        <p className="text-body text-text-2">
          {discounts.length === 0
            ? "The factory's price tiers are not on file yet, so no saving is shown."
            : "Prices drop automatically as the pieces in one order add up across sizes and names. The savings come from the factory's price tiers and are placeholders."}
        </p>
      </div>
      {discounts.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {discounts.slice(0, 4).map((tier) => (
            <li key={tier.minQty} className="flex w-40 flex-col items-center gap-1 rounded-lg border-2 border-navy bg-bg px-4 py-3">
              <span className="text-h2 text-text">{tier.percent}%</span>
              <span className="text-caption text-text-2">{tier.minQty}+ pieces</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * The settings strip (08 v3.5). None of these is a setting a brand can change yet, so each says what
 * is true today rather than showing a choice nobody made.
 */
const SETTINGS = [
  { label: "Order approval", value: "Checked by Knitwright ops" },
  { label: "Default shipping", value: "Not set yet" },
  { label: "Customs", value: "Not set yet" },
  { label: "Notifications", value: "Email from Knitwright ops" },
] as const;

function SettingsStrip() {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-soft px-5 py-3.5 text-body">
      {SETTINGS.map((setting) => (
        <div key={setting.label} className="flex gap-1">
          <dt className="text-text-2">{setting.label}:</dt>
          <dd className="font-semibold text-text">{setting.value}</dd>
        </div>
      ))}
    </dl>
  );
}
