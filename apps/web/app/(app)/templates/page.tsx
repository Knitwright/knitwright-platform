import type { Metadata } from "next";
import { TemplatesView } from "@/components/templates/v3/TemplatesView";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { applyFilters, filtersFromQuery } from "@/lib/templates/filters";
import { feedView, filteredView, shownDesignIds, withDrawn } from "@/lib/templates/feed/rows";
import { loadDesignRows, loadFeed, withPictures } from "@/lib/templates/feed/server";
import { searchFromQuery, tabFromQuery } from "@/lib/templates/feed/tabs";
import { articleChoices } from "@/lib/templates/library";

export const metadata: Metadata = { title: "Templates" };

/**
 * The template library (09 screen 7, decision 0140): Discover rows, a tab per sport and per kind,
 * and a search. Each card reaches the flow that already exists for it: a design is copied and
 * opened in the editor, a launch pack or a social layout opens a launch canvas, a video opens the
 * design's 3D view. The older filter address (`?sport=&article=…`) still works, as one grid.
 */
export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const tab = tabFromQuery(query.tab);
  const search = searchFromQuery(query.q);
  const filters = filtersFromQuery(query);
  const client = await sessionClient();

  const [designs, newest] = await Promise.all([loadDesignRows(client), listProjects(client, brand.id, 1)]);
  const items = await loadFeed(client, designs, newest.projects[0]?.id ?? null);
  const summaries = designs.map((row) => row.summary);
  const view =
    Object.keys(filters).length > 0
      ? filteredView(items, new Set(applyFilters(summaries, filters).map((one) => one.id)), search)
      : feedView(items, tab, search);
  const drawn = withDrawn(view, await withPictures(client, items, shownDesignIds(view)));

  return <TemplatesView tab={tab} search={search} view={drawn} filters={filters} articles={articleChoices(summaries)} empty={items.length === 0} />;
}
