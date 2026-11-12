import { FolderOpen, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { GuideTiles, NewTile } from "@/components/projects/v3/GridTiles";
import { ProjectGrid } from "@/components/projects/v3/ProjectGrid";
import { EmptyList } from "@/components/projects/v3/States";
import { SubNav } from "@/components/projects/v3/SubNav";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { can } from "@/lib/clubs/roles";
import { searchFromQuery, sortFromQuery, visibleItems } from "@/lib/projects-page/items";
import { loadFolders, loadProjectItems } from "@/lib/projects-page/load";
import { PROJECTS_PATH, viewHref } from "@/lib/projects-page/paths";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Projects" };

/**
 * Projects (09 screen 14, d01): the New card, every design and launch project of the brand that is
 * not in the Trash, with its kind, board count and last change, then the guide cards. Sorted and
 * searched from the address, so a view can be linked to and works without a script.
 */
export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const view = { sort: sortFromQuery(query.sort), search: searchFromQuery(query.q) };
  const client = await sessionClient();
  const items = await loadProjectItems(client, brand.id);
  const folders = await loadFolders(client, brand.id, items);
  const shown = visibleItems(items, view);
  const canEdit = can(brand.role, "manageKit");

  return (
    <>
      <h1 className="text-h2 text-text md:sr-only">Projects</h1>
      <SubNav current="projects" path={PROJECTS_PATH} {...view} />
      {view.search !== "" && shown.length === 0 ? (
        <EmptyList
          icon={<Icon icon={SearchX} size={22} />}
          title={`Nothing called "${view.search}"`}
          action={<LinkButton href={viewHref(PROJECTS_PATH, { sort: view.sort })} variant="secondary">Clear the search</LinkButton>}
        >
          <p>No design or launch project has those words in its name.</p>
        </EmptyList>
      ) : (
        <ProjectGrid
          label={`Projects of ${brand.name}`}
          items={shown}
          folders={folders}
          canEdit={canEdit}
          now={new Date()}
          before={canEdit ? <NewTile /> : null}
          after={<GuideTiles />}
        />
      )}
      {items.length === 0 ? (
        <EmptyList icon={<Icon icon={FolderOpen} size={22} />} title="Your first project goes here">
          <p>Press New to start a kit design. Launch packs you make for it are listed here too.</p>
        </EmptyList>
      ) : null}
    </>
  );
}
