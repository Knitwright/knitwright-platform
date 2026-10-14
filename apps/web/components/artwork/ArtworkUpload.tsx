"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Notice } from "@/components/ui/Notice";
import { uploadArtwork, type UploadedArtwork } from "@/lib/artwork-intake/client";
import { FORMATS_HINT } from "@/lib/artwork-intake/wording";
import { LOGO_RIGHTS } from "@/lib/consent/wording";

type UploadProps = Readonly<{ onUploaded: (artwork: UploadedArtwork) => void }>;

const post = (input: string, init?: RequestInit) => fetch(input, init);

/** Choosing a file of the club's own artwork. The person says they may use it on garments before anything is sent. */
export function ArtworkUpload({ onUploaded }: UploadProps) {
  const fileId = useId();
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    if (!file) return setProblem("Choose a file first.");
    if (!rights) return setProblem("Tick the box to say you may use this artwork on garments. Nothing was uploaded.");
    setProblem(null);
    setBusy(true);
    const result = await uploadArtwork(post, file, rights);
    setBusy(false);
    if (result.ok) {
      setFile(null);
      onUploaded(result.data);
    } else setProblem(result.reason);
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label htmlFor={fileId} className="text-sm font-medium text-ink">
        Your artwork
      </label>
      <input
        id={fileId}
        type="file"
        accept="image/png,image/jpeg,image/tiff,application/pdf,.ai,image/svg+xml,.svg"
        disabled={busy}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="text-[15px] text-ink"
      />
      <p className="text-sm text-muted">{FORMATS_HINT}</p>
      <CheckboxField label={LOGO_RIGHTS.text} checked={rights} onChange={(event) => setRights(event.target.checked)} />
      <div>
        <Button type="submit" pending={busy}>
          {busy ? "Reading your file" : "Add artwork"}
        </Button>
      </div>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
    </form>
  );
}
