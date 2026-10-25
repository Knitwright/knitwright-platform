"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import type { GarmentSpec } from "@/lib/garment";
import { LOGO_RIGHTS_WAITING, logoStep, uploadArtworkFile } from "@/lib/projects/artwork-upload";
import { buildArtworkAction, defaultArtworkForm, type ArtworkForm, type Part } from "@/lib/projects/artwork-controls";
import type { ArtworkControlsProps } from "./ArtworkControls";
import { ArtworkFields, Problem } from "./ArtworkFields";
import { NEW_ARTWORK_KEY, UPLOAD_KEY } from "./keys";

const postFile = (form: FormData): Promise<Response> => fetch("/api/files", { method: "POST", body: form });

const newId = (): string => crypto.randomUUID();

type AddProps = Readonly<Pick<ArtworkControlsProps, "spec" | "parts" | "errorFor" | "onSave" | "onProblem" | "onClearProblem">>;

/** Choosing a picture or words, then placing them. Nothing is saved until the person adds it. */
export function AddArtwork({ spec, parts, errorFor, onSave, onProblem, onClearProblem }: AddProps) {
  const [draft, setDraft] = useState<ArtworkForm | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rights, setRights] = useState(false);
  /** A logo chosen before the box was ticked. It is kept and sent once the box is ticked. */
  const [held, setHeld] = useState<File | null>(null);
  const [words, setWords] = useState("");

  const send = async (file: File) => {
    onClearProblem(UPLOAD_KEY);
    setHeld(null);
    setUploading(true);
    const result = await uploadArtworkFile(file, postFile, true);
    setUploading(false);
    if (result.ok) setDraft(defaultArtworkForm(spec, { kind: "file", fileId: result.fileId }, { width: result.width, height: result.height }));
    else onProblem(UPLOAD_KEY, result.reason);
  };

  const choose = (file: File | undefined, ticked: boolean) => {
    const step = logoStep(file ?? null, ticked);
    if (step === "upload" && file) void send(file);
    if (step === "wait-for-rights" && file) {
      setHeld(file);
      onProblem(UPLOAD_KEY, LOGO_RIGHTS_WAITING);
    }
  };

  const tick = (ticked: boolean) => {
    setRights(ticked);
    if (held) choose(held, ticked);
  };

  const add = () => {
    if (!draft) return;
    const request = buildArtworkAction(spec, draft, newId());
    if (request.kind === "problem") return onProblem(NEW_ARTWORK_KEY, request.reason);
    onClearProblem(NEW_ARTWORK_KEY);
    onSave(NEW_ARTWORK_KEY, request.action);
    setDraft(null);
    setWords("");
  };

  return (
    <>
      <div className="grid gap-4 @xl:grid-cols-2">
        <PictureInput
          uploading={uploading}
          rights={rights}
          held={held?.name ?? null}
          onRights={tick}
          error={errorFor(UPLOAD_KEY)}
          onFile={(file) => choose(file, rights)}
        />
        <WordsInput
          words={words}
          onChange={setWords}
          onAdd={() => setDraft(defaultArtworkForm(spec, { kind: "text", text: words.trim() }))}
        />
      </div>
      {draft ? (
        <NewArtworkForm spec={spec} parts={parts} draft={draft} error={errorFor(NEW_ARTWORK_KEY)} onChange={setDraft} onAdd={add} onCancel={() => setDraft(null)} />
      ) : null}
    </>
  );
}

type PictureInputProps = Readonly<{
  uploading: boolean;
  rights: boolean;
  /** The name of a logo chosen before the box was ticked, kept until it is. */
  held: string | null;
  onRights: (ticked: boolean) => void;
  error: string | null;
  onFile: (file: File | undefined) => void;
}>;

/** A logo goes on the garment, so the person confirms they may use it before it is uploaded. */
function PictureInput({ uploading, rights, held, onRights, error, onFile }: PictureInputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Logo or picture
      </label>
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={uploading}
        aria-invalid={error ? true : undefined}
        aria-describedby={[`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(" ")}
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        className="min-h-10 text-[15px] text-ink"
      />
      <p id={`${id}-hint`} className="text-sm text-muted">
        A PNG, JPEG or WebP image, up to 8 MB. Pro team and brand logos need a licence from their owner.
      </p>
      <CheckboxField label={LOGO_RIGHTS.text} checked={rights} onChange={(event) => onRights(event.target.checked)} />
      <p role="status" className="min-h-5 text-sm text-ink-2">
        {uploading ? "Uploading" : held ? `Chosen: ${held}. Waiting for the box to be ticked.` : ""}
      </p>
      <Problem id={`${id}-error`} message={error} />
    </div>
  );
}

type WordsInputProps = Readonly<{ words: string; onChange: (words: string) => void; onAdd: () => void }>;

function WordsInput({ words, onChange, onAdd }: WordsInputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Words to print
      </label>
      <div className="flex gap-2">
        <input id={id} type="text" autoComplete="off" value={words} onChange={(event) => onChange(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink" />
        <Button type="button" variant="secondary" disabled={words.trim() === ""} onClick={onAdd}>
          Add words
        </Button>
      </div>
    </div>
  );
}

type NewFormProps = Readonly<{
  spec: GarmentSpec;
  parts: readonly Part[];
  draft: ArtworkForm;
  error: string | null;
  onChange: (next: ArtworkForm) => void;
  onAdd: () => void;
  onCancel: () => void;
}>;

function NewArtworkForm({ spec, parts, draft, error, onChange, onAdd, onCancel }: NewFormProps) {
  return (
    <form
      aria-label="New artwork"
      className="rounded-xl border border-hairline p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd();
      }}
    >
      <ArtworkFields spec={spec} parts={parts} form={draft} onChange={onChange} />
      <Problem id="new-artwork-error" message={error} />
      <div className="mt-4 flex gap-3">
        <Button type="submit">Add to design</Button>
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
