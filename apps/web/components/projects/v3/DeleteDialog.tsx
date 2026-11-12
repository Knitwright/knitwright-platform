"use client";

import { DeleteForm } from "@/components/deletion/DeleteForm";
import { Modal } from "@/components/ui/Modal";
import { deleteForGoodAction } from "@/lib/projects-page/actions";
import type { ProjectKind } from "@/lib/projects-page/items";

type DeleteDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  item: Readonly<{ kind: ProjectKind; id: string }>;
  name: string;
}>;

const WHAT_GOES: Readonly<Record<ProjectKind, string>> = {
  design: "This deletes the design, every saved version of it, its download records, and the uploaded pictures no other design uses.",
  launch: "This deletes the launch project, its boards, its saved versions and the AI scenes made on it.",
};

/** Deletes a project in the Trash for good, after the person types the word. It cannot be undone. */
export function DeleteDialog({ open, onClose, item, name }: DeleteDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Delete ${name} for good?`} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-2">{WHAT_GOES[item.kind]} It cannot be undone.</p>
        <DeleteForm action={deleteForGoodAction} hidden={{ kind: item.kind, id: item.id }} submitLabel="Delete for good" busyLabel="Deleting" />
      </div>
    </Modal>
  );
}
