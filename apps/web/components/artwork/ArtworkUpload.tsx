"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { ARTWORK_ACCEPT, UPLOAD_HINT, uploadArtwork } from "@/lib/artwork-intake/client";
import type { ArtworkSummary } from "@/lib/artwork-intake/records";
import { LOGO_RIGHTS } from "@/lib/consent/wording";

type Props = Readonly<{ onUploaded: (artwork: ArtworkSummary) => void }>;

/** Choosing a file of the club's own artwork. The person confirms they may use it before anything is sent. */
export function ArtworkUpload({ onUploaded }: Props) {
  const id = useId();
  const [rights, setRights] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const result = await uploadArtwork(file, rights);
    setBusy(false);
    if (result.ok) {
      setFile(null);
      onUploaded(result.data.artwork);
    } else setProblem(result.message);
  };

  return (
    <form
      aria-label="Add your own artwork"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Your artwork
      </label>
      <input
        id={id}
        type="file"
        accept={ARTWORK_ACCEPT}
        disabled={busy}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="text-[15px] text-ink"
      />
      <p id={`${id}-hint`} className="text-sm text-muted">
        {UPLOAD_HINT}
      </p>
      <CheckboxField label={LOGO_RIGHTS.text} checked={rights} onChange={(event) => setRights(event.target.checked)} />
      <div>
        <Button type="submit" variant="secondary" pending={busy} disabled={!file || busy}>
          Add artwork
        </Button>
      </div>
      <p role={problem ? "alert" : "status"} className="min-h-5 text-sm text-ink-2">
        {busy ? "Preparing your file. Large pictures take a few seconds." : (problem ?? "")}
      </p>
    </form>
  );
}
