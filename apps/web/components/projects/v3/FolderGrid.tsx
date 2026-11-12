import { Folder } from "lucide-react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { projectCount, type FolderSummary } from "@/lib/projects-page/items";
import { folderPath } from "@/lib/projects-page/paths";
import { GRID } from "./GridTiles";

/** One folder (d03): a `soft` box with the folder glyph, its name and how many projects are in it. */
function FolderTile({ folder }: Readonly<{ folder: FolderSummary }>) {
  return (
    <li className="min-w-0" data-testid="folder-tile">
      <Link href={folderPath(folder.id)} className="group flex flex-col gap-2 text-text no-underline">
        <span className="grid aspect-[4/3] place-items-center rounded-lg bg-soft text-muted-2 transition-colors duration-fast group-hover:bg-soft-2">
          <Icon icon={Folder} size={22} className="size-15 stroke-[1.5]" />
        </span>
        <span className="truncate text-body-lg font-semibold" title={folder.name}>
          {folder.name}
        </span>
        <span className="-mt-1.5 text-small text-muted">{projectCount(folder.count)}</span>
      </Link>
    </li>
  );
}

export function FolderGrid({ folders }: Readonly<{ folders: readonly FolderSummary[] }>) {
  return (
    <ul aria-label="Folders" className={GRID}>
      {folders.map((folder) => (
        <FolderTile key={folder.id} folder={folder} />
      ))}
    </ul>
  );
}
