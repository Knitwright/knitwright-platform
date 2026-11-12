import type { Route } from "next";
import { LinkTabs } from "@/components/team/v3/LinkTabs";
import { BRAND_TABS, TAB_LABELS, type BrandTabName } from "@/lib/brand-studio/words";

/**
 * The seven tabs of the Brand page (spec F-S9, 08 §4.6), as links, so the page keeps working without
 * scripts and every tab has its own address. The v3.9 underline tabs (decision 0144).
 */
export function BrandTabs({ current }: Readonly<{ current: BrandTabName }>) {
  return (
    <LinkTabs
      label="Brand"
      current={current}
      tabs={BRAND_TABS.map((tab) => ({ id: tab, label: TAB_LABELS[tab], href: (tab === "overview" ? "/brand?tab=overview" : `/brand?tab=${tab}`) as Route }))}
    />
  );
}
