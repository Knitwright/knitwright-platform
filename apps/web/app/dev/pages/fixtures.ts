import "server-only";
import type { MockupsViewProps } from "@/components/mockups/v3/MockupsView";
import type { MarketingViewProps } from "@/components/marketing/v3/MarketingView";
import type { TemplatesViewProps } from "@/components/templates/v3/TemplatesView";
import { FLOW_TEMPLATES } from "@/lib/flows/templates";
import { featuredConcepts, galleryConcepts, photoConcepts, videoConcept } from "@/lib/marketing/gallery/concepts";
import { buildMarketingTemplates } from "@/lib/marketing/templates/build";
import { VIDEO_TEMPLATES, buildableNow, waitingLine } from "@/lib/media/video/social-frames";
import { cardsFor } from "@/lib/mockups/gallery/cards";
import { ALL_MOCKUP_SCENES } from "@/lib/mockups/scenes";
import { designItem, packItem, socialItems, videoItem, withPicture, type FeedItem } from "@/lib/templates/feed/items";
import { feedView, shownDesignIds, withDrawn } from "@/lib/templates/feed/rows";
import { tagsOf } from "@/lib/templates/seed/tagging";
import { allSeedTemplates } from "@/lib/templates/seed/all";
import { previewOf } from "@/lib/templates/preview";

/**
 * Made-up data for the three P2 pages (decision 0140), from the library as the code seeds it, so
 * the 1440 × 900 comparisons with d13–d15 need no database and no session. Nothing here is a brand's.
 */

const seeds = allSeedTemplates();
const STUDIO = "/studio/start";

const designs = (): readonly FeedItem[] =>
  seeds.map((seed, at) =>
    designItem({
      summary: { id: `00000000-0000-4000-8000-${String(at).padStart(12, "0")}`, slug: seed.slug, title: seed.title, sport: seed.sport, articleId: seed.articleId, style: seed.style, styleTags: seed.styleTags, colourFamily: seed.colourFamily, reviewState: seed.reviewState },
      sportTags: tagsOf(seed).sport,
    }),
  );

const waiting = (key: string): string | null => {
  const template = VIDEO_TEMPLATES.find((one) => one.key === key)!;
  return buildableNow(template) ? null : (waitingLine(template) ?? "Not yet.");
};

export function templatesFixture(tab: TemplatesViewProps["tab"]): TemplatesViewProps {
  const designed = designs();
  const items = [...designed, ...FLOW_TEMPLATES.map(packItem), ...socialItems(buildMarketingTemplates()), ...VIDEO_TEMPLATES.map((one) => videoItem(one, STUDIO, waiting(one.key)))];
  const view = feedView(items, tab, "");
  const shown = new Set(shownDesignIds(view));
  const drawn = designed.filter((item) => shown.has(item.id)).map((item) => withPicture(item, previewOf(seeds[designed.indexOf(item)]!.snapshot)));
  return { tab, search: "", view: withDrawn(view, drawn), filters: {}, articles: [], empty: false };
}

const firstSeed = seeds.find((seed) => seed.articleId === "team-jersey") ?? seeds[0]!;

export function mockupsFixture(): MockupsViewProps {
  const preview = previewOf(firstSeed.snapshot);
  const colourways = firstSeed.snapshot.colourways.map((one) => ({ id: one.id, name: one.name }));
  return {
    product: { id: "00000000-0000-4000-8000-000000000001", name: firstSeed.title, colourways, colourwayId: colourways[0]!.id, front: preview?.src ?? null, back: preview?.src ?? null, alt: preview?.alt ?? "" },
    choices: [{ id: "00000000-0000-4000-8000-000000000001", name: firstSeed.title }],
    category: "all",
    cards: cardsFor(ALL_MOCKUP_SCENES, "all"),
  };
}

export function marketingFixture(): MarketingViewProps {
  const concepts = [...photoConcepts(buildMarketingTemplates()), ...VIDEO_TEMPLATES.map((one) => videoConcept(one, STUDIO, waiting(one.key)))];
  const filter = { kind: "all" as const, group: null, sport: null };
  return {
    featured: featuredConcepts(concepts),
    gallery: galleryConcepts(concepts, filter),
    filter,
    sports: [{ id: "football", label: "Football" }],
    garment: previewOf(firstSeed.snapshot),
  };
}
