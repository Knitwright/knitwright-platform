import { ArrowLeft, FolderOpen } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RenameFolder } from "@/components/projects/v3/FolderForm";
import { ProjectGrid } from "@/components/projects/v3/ProjectGrid";
import { RemoveFolder } from "@/components/projects/v3/RemoveFolder";
import { EmptyList } from "@/components/projects/v3/States";
import { Icon } from "@/components/ui/Icon";
import { can } from "@/lib/clubs/roles";
import { projectCount, searchFromQuery, sortFromQuery, visibleItems } from "@/lib/projects-page/items";
import { loadFolders, loadProjectItems } from "@/lib/projects-page/load";
import { FOLDERS_PATH } from "@/lib/projects-page/paths";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Folder" };

/** One folder: its projects, and Rename and Remove for admins and kit managers. Another brand's folder is not found. */
export default async function FolderPage({ params, searchParams }: PageProps<"/projects/folders/[folderId]">) {
  const { brand } = await requireMember();
  const [{ folderId }, query] = await Promise.all([params, searchParams]);
  const client = await sessionClient();
  const items = await loadProjectItems(client, brand.id);
  const folders = await loadFolders(client, brand.id, items);
  const folder = folders.find((entry) => entry.id === folderId);
  if (!folder) notFound();
  const shown = visibleItems(items, { sort: sortFromQuery(query.sort), search: searchFromQuery(query.q), folderId });
  const canEdit = can(brand.role, "manageKit");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href={FOLDERS_PATH as Route} className="inline-flex items-center gap-1.5 text-small text-muted no-underline hover:text-text">
            <Icon icon={ArrowLeft} size={16} />
            Folders
          </Link>
          <h1 className="text-h1 text-text">{folder.name}</h1>
          <p className="text-small text-muted">{projectCount(folder.count)}</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <RenameFolder folderId={folder.id} name={folder.name} />
            <RemoveFolder folderId={folder.id} name={folder.name} />
          </div>
        ) : null}
      </div>
      {shown.length > 0 ? (
        <ProjectGrid label={`Projects in ${folder.name}`} items={shown} folders={folders} canEdit={canEdit} now={new Date()} />
      ) : (
        <EmptyList icon={<Icon icon={FolderOpen} size={22} />} title="This folder is empty">
          <p>Move a project here from the menu on its card in Projects.</p>
        </EmptyList>
      )}
    </>
  );
}
