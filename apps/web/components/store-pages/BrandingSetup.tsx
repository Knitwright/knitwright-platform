"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Inputs";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { saveBrandingAction } from "@/lib/store-pages/actions";

/** "Set up" on a branding card (prototype p18): switch the item on for every parcel and add a note. */
export function BrandingSetup({ optionId, name, on, note }: Readonly<{ optionId: string; name: string; on: boolean; note: string }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(on);
  const [text, setText] = useState(note);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const reply = await saveBrandingAction({ optionId, on: checked, note: text }).catch(() => null);
      if (!reply) return setProblem("Not saved. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button variant={on ? "secondary" : "primary"} onClick={() => { setProblem(null); setOpen(true); }} aria-label={`${on ? "Edit" : "Set up"} ${name}`}>
        {on ? "Edit" : "Set up"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        size="sm"
        dirty={checked !== on || text !== note}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} pending={pending}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Toggle checked={checked} onChange={setChecked} label={`Add ${name.toLowerCase()} to every order`} />
          <Field name="note" label="Note for Knitwright" maxLength={200} value={text} onChange={(event) => setText(event.target.value)} hint="For example the message on the card, or which crest to print." />
          {problem ? (
            <Notice tone="warn" role="alert">
              {problem}
            </Notice>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
