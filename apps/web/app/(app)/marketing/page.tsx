import type { Metadata } from "next";
import { MarketingView } from "@/components/marketing/v3/MarketingView";
import { featuredConcepts, galleryConcepts, galleryFilterFromQuery } from "@/lib/marketing/gallery/concepts";
import { garmentOnCards, loadConcepts } from "@/lib/marketing/gallery/server";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { SPORT_TABS, TEMPLATE_TAB_LABELS } from "@/lib/templates/feed/tabs";

export const metadata: Metadata = { title: "Marketing" };

/**
 * The Marketing page (09 screen 9, decision 0140): Create an ad (a launch canvas with an empty
 * marketing board, whose panel holds the campaign form), Plan a launch pack, the Featured concepts
 * and the Ad gallery. Every concept is one of the library's layouts or video templates, and Use
 * this concept opens the flow that already makes it.
 */
export default async function MarketingPage({ searchParams }: PageProps<"/marketing">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const client = await sessionClient();
  const latest = (await listProjects(client, brand.id, 1)).projects[0]?.id ?? null;
  const filter = galleryFilterFromQuery(query, SPORT_TABS);
  const [concepts, garment] = await Promise.all([loadConcepts(client, latest), garmentOnCards(client, brand.id, latest, filter.sport)]);
  const sports = SPORT_TABS.filter((one) => garment.sports.includes(one)).map((id) => ({ id, label: TEMPLATE_TAB_LABELS[id] }));

  return (
    <MarketingView
      featured={featuredConcepts(concepts)}
      gallery={galleryConcepts(concepts, filter)}
      filter={filter}
      sports={sports}
      garment={garment.preview}
    />
  );
}
