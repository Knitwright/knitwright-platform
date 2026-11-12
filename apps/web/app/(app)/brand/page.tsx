import type { Metadata } from "next";
import { z } from "zod";
import { BrandEmpty } from "@/components/brand/v3/BrandEmpty";
import { BrandSideCard } from "@/components/brand/v3/BrandSideCard";
import { BrandTabPanels } from "@/components/brand/v3/BrandTabPanels";
import { StyleBanner } from "@/components/brand/v3/StyleBanner";
import { BrandTabs } from "@/components/brand-studio/BrandTabs";
import { CHECKED_KINDS, type CheckedAsset } from "@/lib/brand-studio/assets";
import { completionOf } from "@/lib/brand-studio/completion";
import { brandIsEmpty } from "@/lib/brand-studio/overview-cards";
import { loadBrand } from "@/lib/brand-studio/service";
import { BRAND_TABS, STYLE_FIELDS } from "@/lib/brand-studio/words";
import { can } from "@/lib/clubs/roles";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Brand" };

const query = z.object({ tab: z.enum(BRAND_TABS).optional().catch(undefined) });

/**
 * Brand (09 screen 18, 08 §4.6, d16 and d17; plan v6 P6, decision 0144), moved from Brand Studio
 * (spec F-S9; decision 0079), which redirects here. Before anything is saved it is the empty state:
 * import from a URL, or create by hand. After, the Kittl layout: the side card with Brand completion,
 * the visual-style banner, and the tabs Overview · Logos · Colours · Fonts · Graphics · Visual style ·
 * Sportswear. The tabs are links, so the page works without scripts and every tab has its own address.
 *
 * Your club kit is written on the Sportswear tab; the Colours tab reads it through (decision 0079).
 */
export default async function BrandPage({ searchParams }: PageProps<"/brand">) {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const asked = query.parse(await searchParams).tab;
  const { record, kitFonts, uploads } = await loadBrand(client, brand);
  const canEdit = can(brand.role, "manageKit");

  if (asked === undefined && brandIsEmpty(record)) return <BrandEmpty canEdit={canEdit} />;

  const tab = asked ?? "overview";
  const checked: readonly CheckedAsset[] = record.assets
    .filter((asset) => CHECKED_KINDS.some((kind) => kind === asset.kind))
    .map((asset) => ({ asset, artwork: uploads.find((upload) => upload.artworkId === asset.artworkId) ?? null }));
  const styleSet = STYLE_FIELDS.every((field) => record.profile.style[field].trim() !== "");

  return (
    <div className="grid items-start gap-6 pt-2 pb-16 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <h1 className="sr-only">Brand · {brand.name}</h1>
      <BrandSideCard name={brand.name} about={record.profile.about} website={record.profile.website} percent={completionOf(record).percent} />
      <div className="flex min-w-0 flex-col gap-6">
        <StyleBanner set={styleSet} canEdit={canEdit} />
        <BrandTabs current={tab} />
        <BrandTabPanels tab={tab} brand={brand} record={record} kitFonts={kitFonts} uploads={uploads} checked={checked} canEdit={canEdit} />
      </div>
    </div>
  );
}
