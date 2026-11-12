import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { ProjectGrid } from "@/components/projects/v3/ProjectGrid";
import { EmptyList, ViewerOnly } from "@/components/projects/v3/States";
import { SubNav } from "@/components/projects/v3/SubNav";
import { Icon } from "@/components/ui/Icon";
import { can } from "@/lib/clubs/roles";
import { searchFromQuery, sortFromQuery, visibleItems } from "@/lib/projects-page/items";
import { loadProjectItems } from "@/lib/projects-page/load";
import { TRASH_PATH } from "@/lib/projects-page/paths";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Trash" };

const STAYS = "Projects in the Trash stay here until you restore them or delete them for good. A design that has been ordered can't be moved here.";

/** Trash (d05): projects moved here, newest first, each with Restore and Delete for good. A viewer is told who can. */
export default async function TrashPage({ searchParams }: PageProps<"/projects/trash">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const view = { sort: sortFromQuery(query.sort), search: searchFromQuery(query.q) };
  const canEdit = can(brand.role, "manageKit");
  const items = await loadProjectItems(await sessionClient(), brand.id);
  const shown = visibleItems(items, { ...view, trashed: true });

  return (
    <>
      <h1 className="text-h2 text-text md:sr-only">Trash</h1>
      <SubNav current="trash" path={TRASH_PATH} {...view} />
      {!canEdit ? (
        <ViewerOnly brandName={brand.name} />
      ) : shown.length > 0 ? (
        <>
          <p className="-mt-2 text-small text-muted">{STAYS}</p>
          <ProjectGrid label="Projects in the Trash" items={shown} folders={[]} canEdit now={new Date()} />
        </>
      ) : (
        <EmptyList icon={<Icon icon={Trash2} size={22} />} title={view.search === "" ? "Trash is empty" : "Nothing in the Trash has that name"}>
          <p>{STAYS}</p>
        </EmptyList>
      )}
    </>
  );
}
