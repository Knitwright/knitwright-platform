"use client";

import { ExternalLink, FolderInput, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { restoreItemAction, trashItemAction } from "@/lib/projects-page/actions";
import type { ProjectKind } from "@/lib/projects-page/items";
import { DeleteDialog } from "./DeleteDialog";
import { MoveDialog, type FolderChoice } from "./MoveDialog";
import { useChange } from "./use-change";

type ItemMenuProps = Readonly<{
  kind: ProjectKind;
  id: string;
  name: string;
  href: Route;
  folderId: string | null;
  folders: readonly FolderChoice[];
  /** In the Trash the menu restores or deletes for good; elsewhere it opens, moves or trashes. */
  trashed: boolean;
}>;

/** A card's ⋯ menu (08 §4.4): Open, Move to folder and Move to Trash; in the Trash, Restore and Delete for good. */
export function ItemMenu({ kind, id, name, href, folderId, folders, trashed }: ItemMenuProps) {
  const router = useRouter();
  const { run } = useChange();
  const [dialog, setDialog] = useState<"move" | "delete" | null>(null);
  const item = { kind, id };

  const live: readonly MenuEntry[] = [
    { id: "open", label: "Open", icon: <Icon icon={ExternalLink} size={20} />, onSelect: () => router.push(href) },
    { id: "move", label: "Move to folder", icon: <Icon icon={FolderInput} size={20} />, onSelect: () => setDialog("move") },
    { id: "sep", separator: true },
    { id: "trash", label: "Move to Trash", danger: true, icon: <Icon icon={Trash2} size={20} />, onSelect: () => run(trashItemAction, item, `${name} is in the Trash`) },
  ];
  const inTrash: readonly MenuEntry[] = [
    { id: "restore", label: "Restore", icon: <Icon icon={RotateCcw} size={20} />, onSelect: () => run(restoreItemAction, item, `${name} is back in Projects`) },
    { id: "delete", label: "Delete for good", danger: true, icon: <Icon icon={Trash2} size={20} />, onSelect: () => setDialog("delete") },
  ];

  return (
    <>
      <Menu label={`More for ${name}`} iconOnly icon={<Icon icon={MoreHorizontal} size={20} />} size="sm" align="end" compact items={trashed ? inTrash : live} />
      <MoveDialog open={dialog === "move"} onClose={() => setDialog(null)} item={item} name={name} folderId={folderId} folders={folders} />
      <DeleteDialog open={dialog === "delete"} onClose={() => setDialog(null)} item={item} name={name} />
    </>
  );
}
