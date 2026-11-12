import { Folder } from "lucide-react";
import type { Metadata } from "next";
import { FolderGrid } from "@/components/projects/v3/FolderGrid";
import { NewFolder } from "@/components/projects/v3/FolderForm";
import { EmptyList } from "@/components/projects/v3/States";
import { SubNav } from "@/components/projects/v3/SubNav";
import { Icon } from "@/components/ui/Icon";
import { can } from "@/lib/clubs/roles";
import { searchFromQuery, sortFromQuery, visibleFolders } from "@/lib/projects-page/items";
import { loadFolders, loadProjectItems } from "@/lib/projects-page/load";
import { FOLDERS_PATH } from "@/lib/projects-page/paths";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Folders" };

/** Folders (d03): each folder with how many projects are in it. Admins and kit managers can make one. */
export default async function FoldersPage({ searchParams }: PageProps<"/projects/folders">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const view = { sort: sortFromQuery(query.sort), search: searchFromQuery(query.q) };
  const client = await sessionClient();
  const folders = await loadFolders(client, brand.id, await loadProjectItems(client, brand.id));
  const shown = visibleFolders(folders, view);
  const canEdit = can(brand.role, "manageKit");

  return (
    <>
      <h1 className="text-h2 text-text md:sr-only">Folders</h1>
      <SubNav current="folders" path={FOLDERS_PATH} searchLabel="Search folders" extra={canEdit ? <NewFolder /> : null} {...view} />
      {shown.length > 0 ? (
        <FolderGrid folders={shown} />
      ) : (
        <EmptyList icon={<Icon icon={Folder} size={22} />} title={folders.length === 0 ? "No folders yet" : "No folder has that name"}>
          <p>
            {folders.length === 0
              ? canEdit
                ? "Make a folder with New folder, then move projects into it from each card's menu."
                : "When an admin or kit manager makes folders, they are listed here."
              : "Try another word, or clear the search."}
          </p>
        </EmptyList>
      )}
    </>
  );
}
