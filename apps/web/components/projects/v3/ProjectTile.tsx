import { Rocket, Shirt } from "lucide-react";
import { ProjectCard } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { changedWhen } from "@/lib/home/when";
import { cardLine, itemHref, KIND_LABELS, type ProjectItem } from "@/lib/projects-page/items";
import { ItemMenu } from "./ItemMenu";
import type { FolderChoice } from "./MoveDialog";

type ProjectTileProps = Readonly<{
  item: ProjectItem;
  folders: readonly FolderChoice[];
  /** False for a viewer, who may look but not move or trash anything: the card has no ⋯ menu. */
  canEdit: boolean;
  now: Date;
}>;

/** The picture on a card until E1 gives every project a rendered thumbnail: the kind's glyph on `soft`. */
function KindArt({ item }: Readonly<{ item: ProjectItem }>) {
  return (
    <span className="relative grid size-full place-items-center">
      <span className="grid size-20 place-items-center rounded-2xl bg-bg text-navy shadow-e1">
        <Icon icon={item.kind === "design" ? Shirt : Rocket} size={22} />
      </span>
      <Tag tone={item.kind === "design" ? "info" : "beta"} className="absolute bottom-2.5 left-2.5">
        {KIND_LABELS[item.kind]}
      </Tag>
    </span>
  );
}

/** One design or launch project (08 §4.4): its picture, kind, name, board count, when it changed, and ⋯. */
export function ProjectTile({ item, folders, canEdit, now }: ProjectTileProps) {
  const trashed = item.trashedAt !== null;
  return (
    <li className="min-w-0" data-testid="project-tile" data-kind={item.kind}>
      <ProjectCard
        title={item.name}
        meta={cardLine(item, now, changedWhen)}
        count={item.artboards ?? undefined}
        href={trashed ? undefined : itemHref(item)}
        thumb={<KindArt item={item} />}
        menu={
          canEdit ? (
            <ItemMenu kind={item.kind} id={item.id} name={item.name} href={itemHref(item)} folderId={item.folderId} folders={folders} trashed={trashed} />
          ) : undefined
        }
      />
    </li>
  );
}
