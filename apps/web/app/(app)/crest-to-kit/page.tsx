import type { Metadata } from "next";
import { CrestToKit } from "@/components/crest-to-kit/CrestToKit";
import { PageIntro } from "@/components/shell/PageIntro";
import { PAGE_EYEBROW, PAGE_LEAD, PAGE_TITLE } from "@/lib/crest-to-kit/words";
import { CLUB_PALETTE } from "@/lib/kit-styles/presets";
import { requireMember } from "@/lib/server/page-guards";
import { SPORTS } from "@/lib/teamwear/vocabulary";

export const metadata: Metadata = { title: PAGE_TITLE };

/**
 * Crest to kit (spec F-T2): upload a crest or pick colours, and see complete kits built from the
 * base article's own options.
 *
 * The page itself reads nothing: the sports and the club swatches are tables, and the kits are
 * asked for after the form is filled in, so the screen is on the phone at once and the work starts
 * when the club presses the button. The swatches are handed down as props rather than imported by
 * the client component, so the garment rules stay out of the browser.
 */
export default async function CrestToKitPage() {
  const { brand } = await requireMember();
  return (
    <div className="flex flex-col gap-8">
      <PageIntro eyebrow={`${PAGE_EYEBROW} · ${brand.name}`} title={PAGE_TITLE} lead={PAGE_LEAD} />
      <CrestToKit
        sports={SPORTS.map((sport) => ({ id: sport.id, label: sport.label }))}
        swatches={CLUB_PALETTE.map((entry) => ({ name: entry.name, swatch: entry.swatch }))}
      />
    </div>
  );
}
