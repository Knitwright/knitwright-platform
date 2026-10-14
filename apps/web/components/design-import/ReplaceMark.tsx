"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { LOGO_RIGHTS } from "@/lib/consent/wording";

type Props = Readonly<{
  layerLabel: string;
  disabled: boolean;
  /** Takes in the file through the artwork upload and puts it in the layer. Gives a plain sentence when it could not. */
  onReplace: (file: File, rights: boolean) => Promise<string | null>;
}>;

/** One click to replace a crest, sponsor or badge redrawn from the picture with the club's own file. */
export function ReplaceMark({ layerLabel, disabled, onReplace }: Props) {
  const [open, setOpen] = useState(false);
  const [rights, setRights] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    if (!file) return setProblem("Choose a file first.");
    if (!rights) return setProblem("Tick the box to say you may use this artwork on garments. Nothing was uploaded.");
    setBusy(true);
    setProblem(null);
    const failed = await onReplace(file, rights);
    setBusy(false);
    if (failed) setProblem(failed);
  };

  if (!open) {
    return (
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
        Replace with your own file
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="replace-mark">
      <label className="text-sm font-medium text-ink">
        Your file for {layerLabel}
        <input type="file" accept="image/png,image/jpeg,image/tiff,application/pdf,.ai,image/svg+xml,.svg" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
      </label>
      <CheckboxField label={LOGO_RIGHTS.text} checked={rights} disabled={busy} onChange={(event) => setRights(event.target.checked)} />
      {problem ? (
        <p role="alert" className="text-sm text-warn">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" pending={busy} onClick={() => void send()}>
          {busy ? "Adding your file" : "Use this file"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
