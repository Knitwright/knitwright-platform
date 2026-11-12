"use client";

import { FolderMinus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { removeFolderAction } from "@/lib/projects-page/actions";
import { useChange } from "./use-change";

/** Removes a folder, after asking. The projects in it stay, in no folder. */
export function RemoveFolder({ folderId, name }: Readonly<{ folderId: string; name: string }>) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useChange();
  return (
    <>
      <Button variant="danger" icon={<Icon icon={FolderMinus} size={20} />} onClick={() => setOpen(true)}>
        Remove folder
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Remove ${name}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" data-primary pending={pending} onClick={() => run(removeFolderAction, { folderId }, `${name} is removed`)}>
              Remove folder
            </Button>
          </>
        }
      >
        <p className="text-body text-text-2">The projects in it are kept. They go back to Projects, in no folder.</p>
      </Modal>
    </>
  );
}
