import type { Metadata } from "next";
import { z } from "zod";
import { BrandTabs } from "@/components/brand-studio/BrandTabs";
import { ColoursPanel } from "@/components/brand-studio/ColoursPanel";
import { DetailsForm } from "@/components/brand-studio/DetailsForm";
import { FontsPanel } from "@/components/brand-studio/FontsPanel";
import { OverviewPanel } from "@/components/brand-studio/OverviewPanel";
import { PicturesPanel } from "@/components/brand-studio/PicturesPanel";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { CHECKED_KINDS, type CheckedAsset } from "@/lib/brand-studio/assets";
import { loadBrand } from "@/lib/brand-studio/service";
import { BRAND_TABS, CATEGORY_LABELS, KIND_LABELS, TAB_LABELS } from "@/lib/brand-studio/words";
import { can, ROLE_LABELS } from "@/lib/clubs/roles";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Brand Studio" };

const query = z.object({ tab: z.enum(BRAND_TABS).optional().catch(undefined) });

/**
 * Brand Studio, typed by hand (spec F-S9 without the URL import, which is L7). The tabs are links,
 * so the page works without scripts and every tab has its own address.
 *
 * Your club kit stays on `/club`: this page reads it through and never writes it (decision 0079).
 */
export default async function BrandStudioPage({ searchParams }: PageProps<"/brand-studio">) {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const tab = query.parse(await searchParams).tab ?? "overview";
  const { record, kitFonts, uploads } = await loadBrand(client, brand);
  const canEdit = can(brand.role, "manageKit");

  const checked: readonly CheckedAsset[] = record.assets
    .filter((asset) => CHECKED_KINDS.some((kind) => kind === asset.kind))
    .map((asset) => ({ asset, artwork: uploads.find((upload) => upload.artworkId === asset.artworkId) ?? null }));

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`${KIND_LABELS[record.profile.kind]} · you are ${ROLE_LABELS[brand.role].toLowerCase()}`}
        title={brand.name}
        lead={`Your brand, applied everywhere: ${CATEGORY_LABELS[record.profile.category]}. Paste a website to import it in a later release; for now everything here is typed by hand.`}
      />

      <BrandTabs current={tab} />

      {tab === "overview" ? (
        <PageSection id="overview" title={TAB_LABELS.overview} description="What your brand holds, and how much of it is filled in.">
          <OverviewPanel record={record} checked={checked} />
        </PageSection>
      ) : null}

      {tab === "overview" ? (
        <PageSection id="details" title="Details" description="Your category, website, what the brand is about, and the words that describe how it sounds.">
          <DetailsForm profile={record.profile} canEdit={canEdit} part="details" />
        </PageSection>
      ) : null}

      {tab === "colours" ? (
        <PageSection
          id="colours"
          title={TAB_LABELS.colours}
          description="Named palettes. Each colour keeps its screen colour, the Pantone TCX code you type, and the nearest colour a sublimation print is estimated to reach."
        >
          <ColoursPanel palettes={record.palettes} uploads={uploads} canEdit={canEdit} />
        </PageSection>
      ) : null}

      {tab === "fonts" ? (
        <PageSection
          id="fonts"
          title={TAB_LABELS.fonts}
          description="A font for each role. Only a font whose licence is in this repository can be chosen; the rest are placeholders and say so."
        >
          <FontsPanel fonts={record.fonts} kitFonts={kitFonts} canEdit={canEdit} />
        </PageSection>
      ) : null}

      {tab === "logos" ? (
        <PageSection id="logos" title={TAB_LABELS.logos} description="Your logos, chosen from the pictures you have already uploaded.">
          <PicturesPanel kind="logo" assets={record.assets} uploads={uploads} canEdit={canEdit} />
        </PageSection>
      ) : null}

      {tab === "graphics" ? (
        <PageSection id="graphics" title={TAB_LABELS.graphics} description="Patterns, marks and photographs you use on kit and in your launch work.">
          <PicturesPanel kind="graphic" assets={record.assets} uploads={uploads} canEdit={canEdit} />
        </PageSection>
      ) : null}

      {tab === "style" ? (
        <PageSection
          id="style"
          title={TAB_LABELS.style}
          description="Three texts that steer every picture made for you. Typed by hand for now; a later release writes a first draft from your own reference images."
        >
          <DetailsForm profile={record.profile} canEdit={canEdit} part="style" />
        </PageSection>
      ) : null}

      {tab === "sportswear"
        ? (["crest", "sponsor", "label", "packaging"] as const).map((kind) => (
            <PageSection
              key={kind}
              id={`sportswear-${kind}`}
              title={
                kind === "crest"
                  ? "Crest"
                  : kind === "sponsor"
                    ? "Sponsors"
                    : kind === "label"
                      ? "Care and brand label artwork"
                      : "Packaging"
              }
              description={
                kind === "packaging"
                  ? "What your kit arrives in."
                  : "A drawing (SVG or PDF) stays sharp at any size. For a picture made of pixels, tell us how wide it will be printed and we will say whether the file is big enough."
              }
            >
              <PicturesPanel kind={kind} assets={record.assets} uploads={uploads} canEdit={canEdit} />
            </PageSection>
          ))
        : null}
    </div>
  );
}
