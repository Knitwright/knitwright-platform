import { ArtworkPanel } from "@/components/artwork/ArtworkPanel";
import { ColoursPanel } from "@/components/brand-studio/ColoursPanel";
import { DetailsForm } from "@/components/brand-studio/DetailsForm";
import { FontsPanel } from "@/components/brand-studio/FontsPanel";
import { OverviewPanel } from "@/components/brand-studio/OverviewPanel";
import { PicturesPanel } from "@/components/brand-studio/PicturesPanel";
import { PageSection } from "@/components/shell/PageSection";
import type { CheckedAsset } from "@/lib/brand-studio/assets";
import type { ArtworkFacts, BrandRecord, KitFont } from "@/lib/brand-studio/types";
import { TAB_LABELS, type BrandTabName } from "@/lib/brand-studio/words";
import type { Brand } from "@/lib/server/core/guard";
import { KitSection } from "./KitSection";

/**
 * What each tab of the Brand page holds (spec F-S9; plan v5 Y6, decision 0079; moved from Brand Studio
 * by decision 0144). The panels, their forms and their actions are Brand Studio's, unchanged.
 */

type Props = Readonly<{
  tab: BrandTabName;
  brand: Brand;
  record: BrandRecord;
  kitFonts: readonly KitFont[];
  uploads: readonly ArtworkFacts[];
  checked: readonly CheckedAsset[];
  canEdit: boolean;
}>;

const SPORTSWEAR = [
  { kind: "crest", title: "Crest" },
  { kind: "sponsor", title: "Sponsors" },
  { kind: "label", title: "Care and brand label artwork" },
  { kind: "packaging", title: "Packaging" },
] as const;

const PIXELS =
  "A drawing (SVG or PDF) stays sharp at any size. For a picture made of pixels, tell us how wide it will be printed and we will say whether the file is big enough.";

export function BrandTabPanels({ tab, brand, record, kitFonts, uploads, checked, canEdit }: Props) {
  switch (tab) {
    case "overview":
      return <OverviewTab record={record} checked={checked} canEdit={canEdit} />;
    case "colours":
      return (
        <PageSection id="colours" title={TAB_LABELS.colours} description="Named palettes. Each colour keeps its screen colour, the Pantone TCX code you type, and the nearest colour a sublimation print is estimated to reach.">
          <ColoursPanel palettes={record.palettes} uploads={uploads} canEdit={canEdit} />
        </PageSection>
      );
    case "fonts":
      return (
        <PageSection id="fonts" title={TAB_LABELS.fonts} description="A font for each role. Only a font whose licence is in this repository can be chosen; the rest are placeholders and say so.">
          <FontsPanel fonts={record.fonts} kitFonts={kitFonts} canEdit={canEdit} />
        </PageSection>
      );
    case "logos":
      return (
        <PageSection id="logos" title={TAB_LABELS.logos} description="Your logos, chosen from the pictures you have already uploaded.">
          <PicturesPanel kind="logo" assets={record.assets} uploads={uploads} canEdit={canEdit} />
        </PageSection>
      );
    case "graphics":
      return (
        <PageSection id="graphics" title={TAB_LABELS.graphics} description="Patterns, marks and photographs you use on kit and in your launch work.">
          <PicturesPanel kind="graphic" assets={record.assets} uploads={uploads} canEdit={canEdit} />
        </PageSection>
      );
    case "style":
      return (
        <PageSection id="style" title={TAB_LABELS.style} description="Three texts that steer every picture made for you: the setting, the art direction, and the rules and boundaries. Import your site to get a first draft written for you.">
          <DetailsForm profile={record.profile} canEdit={canEdit} part="style" />
        </PageSection>
      );
    case "sportswear":
      return (
        <div className="flex flex-col gap-6">
          {SPORTSWEAR.map(({ kind, title }) => (
            <PageSection key={kind} id={`sportswear-${kind}`} title={title} description={kind === "packaging" ? "What your kit arrives in." : PIXELS}>
              <PicturesPanel kind={kind} assets={record.assets} uploads={uploads} canEdit={canEdit} />
            </PageSection>
          ))}
          <KitSection brand={brand} />
        </div>
      );
  }
}

function OverviewTab({ record, checked, canEdit }: Readonly<{ record: BrandRecord; checked: readonly CheckedAsset[]; canEdit: boolean }>) {
  return (
    <div className="flex flex-col gap-6">
      <PageSection id="overview" title={TAB_LABELS.overview} description="What your brand holds, and how much of it is filled in.">
        <OverviewPanel record={record} checked={checked} />
      </PageSection>
      <PageSection id="details" title="Details" description="Your category, website, what the brand is about, and the words that describe how it sounds.">
        <DetailsForm profile={record.profile} canEdit={canEdit} part="details" />
      </PageSection>
      {/*
       * The brand's own files (W7b, decision 0036), which every picture picker on this page chooses from
       * (decision 0124). It sits on Overview because the other tabs cannot be filled without it.
       */}
      <PageSection
        id="artwork"
        title="Your artwork"
        description="Your own crests, sponsor logos, badges and photographs. For each one you can see what the file is, how sharply it would print at the size you want, and whether a repeat of it would show a seam. Every picture here belongs to the brand, so any design can use it, and the Logos, Graphics and Sportswear tabs take theirs from this list."
      >
        <ArtworkPanel />
      </PageSection>
    </div>
  );
}
