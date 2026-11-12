"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { placeItemAction } from "@/lib/projects-page/actions";
import type { ProjectKind } from "@/lib/projects-page/items";
import { useChange } from "./use-change";

export type FolderChoice = Readonly<{ id: string; name: string }>;

type MoveDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  item: Readonly<{ kind: ProjectKind; id: string }>;
  name: string;
  folderId: string | null;
  folders: readonly FolderChoice[];
}>;

/** Moves one project into a folder, or out of the folder it is in. */
export function MoveDialog({ open, onClose, item, name, folderId, folders }: MoveDialogProps) {
  const [chosen, setChosen] = useState(folderId ?? "");
  const { run, pending } = useChange();
  const options = [{ id: "", label: "No folder" }, ...folders.map((folder) => ({ id: folder.id, label: folder.name }))];
  const target = folders.find((folder) => folder.id === chosen)?.name;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move ${name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button data-primary pending={pending} onClick={() => run(placeItemAction, { ...item, folderId: chosen }, target ? `Moved to ${target}` : "Taken out of its folder", onClose)}>
            Move
          </Button>
        </>
      }
    >
      {folders.length === 0 ? <p className="mb-3 text-body text-muted">You have no folders yet. Make one on the Folders tab.</p> : null}
      <SelectField name="folderId" label="Folder" value={chosen} onChange={(event) => setChosen(event.target.value)} options={options} />
    </Modal>
  );
}
