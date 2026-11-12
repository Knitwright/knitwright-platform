import type { ReactNode } from "react";
import type { ProjectItem } from "@/lib/projects-page/items";
import { GRID } from "./GridTiles";
import type { FolderChoice } from "./MoveDialog";
import { ProjectTile } from "./ProjectTile";

type ProjectGridProps = Readonly<{
  label: string;
  items: readonly ProjectItem[];
  folders: readonly FolderChoice[];
  canEdit: boolean;
  now: Date;
  /** Cards before the projects, such as "New". */
  before?: ReactNode;
  /** Cards after the projects, such as the guides. */
  after?: ReactNode;
}>;

/** A grid of project cards, with optional cards before and after them. */
export function ProjectGrid({ label, items, folders, canEdit, now, before, after }: ProjectGridProps) {
  return (
    <ul aria-label={label} className={GRID}>
      {before}
      {items.map((item) => (
        <ProjectTile key={`${item.kind}:${item.id}`} item={item} folders={folders} canEdit={canEdit} now={now} />
      ))}
      {after}
    </ul>
  );
}
