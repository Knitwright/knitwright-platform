"use client";

import { FolderPlus, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { createFolderAction, renameFolderAction } from "@/lib/projects-page/actions";

type NameFormProps = Readonly<{
  action: typeof createFolderAction | typeof renameFolderAction;
  folderId?: string;
  name?: string;
  submitLabel: string;
  onDone: () => void;
}>;

/** The one field a folder has. A failure is shown under the field, never only in a toast (10 §9). */
function NameForm({ action, folderId, name = "", submitLabel, onDone }: NameFormProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction<unknown>(action);
  const saved = state.result?.success === true;
  useEffect(() => {
    if (saved) onDone();
  }, [saved, state.attempt, onDone]);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {folderId ? <input type="hidden" name="folderId" value={folderId} /> : null}
      <Field name="name" label="Folder name" maxLength={60} required data-autofocus defaultValue={state.values.name ?? name} errors={fieldErrors("name")} />
      <div className="flex justify-end">
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** "New folder" beside the sub-tabs: makes a folder and opens it. */
export function NewFolder() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" icon={<Icon icon={FolderPlus} size={20} />} onClick={() => setOpen(true)}>
        New folder
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New folder" size="sm">
        <NameForm action={createFolderAction} submitLabel="Make folder" onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

/** Rename, on a folder's own page. */
export function RenameFolder({ folderId, name }: Readonly<{ folderId: string; name: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" icon={<Icon icon={Pencil} size={20} />} onClick={() => setOpen(true)}>
        Rename
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Rename ${name}`} size="sm">
        <NameForm action={renameFolderAction} folderId={folderId} name={name} submitLabel="Save name" onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
