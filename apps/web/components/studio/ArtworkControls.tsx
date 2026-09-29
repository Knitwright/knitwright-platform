"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { uploadArtworkFile } from "@/lib/projects/artwork-upload";
import {
  buildArtworkAction,
  defaultArtworkForm,
  removeArtworkAction,
  type ArtworkForm,
  type ArtworkRow,
  type Part,
} from "@/lib/projects/artwork-controls";
import { ArtworkFields } from "./ArtworkFields";
import { NEW_ARTWORK_KEY, UPLOAD_KEY, artworkKey } from "./keys";

type ArtworkControlsProps = Readonly<{
  /** The design as it will be once waiting changes are saved. */
  spec: GarmentSpec;
  rows: readonly ArtworkRow[];
  parts: readonly Part[];
  errorFor: (key: string) => string | null;
  onSave: (key: string, action: SpecAction) => void;
  onProblem: (key: string, message: string) => void;
  onClearProblem: (key: string) => void;
}>;

const postFile = (form: FormData): Promise<Response> => fetch("/api/files", { method: "POST", body: form });

const newId = (): string => crypto.randomUUID();

function Problem({ id, message }: Readonly<{ id: string; message: string | null }>) {
  return message ? (
    <p id={id} role="alert" className="mt-2 text-sm text-warn">
      {message}
    </p>
  ) : null;
}

type AddProps = Readonly<Pick<ArtworkControlsProps, "spec" | "parts" | "errorFor" | "onSave" | "onProblem" | "onClearProblem">>;

/** Choosing a picture or words, then placing them. Nothing is saved until the person adds it. */
function AddArtwork({ spec, parts, errorFor, onSave, onProblem, onClearProblem }: AddProps) {
  const [draft, setDraft] = useState<ArtworkForm | null>(null);
  const [uploading, setUploading] = useState(false);
  const [words, setWords] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    onClearProblem(UPLOAD_KEY);
    setUploading(true);
    const result = await uploadArtworkFile(file, postFile);
    setUploading(false);
    if (result.ok) setDraft(defaultArtworkForm(spec, { kind: "file", fileId: result.fileId }, { width: result.width, height: result.height }));
    else onProblem(UPLOAD_KEY, result.reason);
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
      <div className="grid gap-4 md:grid-cols-2">
        <PictureInput uploading={uploading} error={errorFor(UPLOAD_KEY)} onFile={(file) => void upload(file)} />
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

type PictureInputProps = Readonly<{ uploading: boolean; error: string | null; onFile: (file: File | undefined) => void }>;

function PictureInput({ uploading, error, onFile }: PictureInputProps) {
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
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        className="text-[15px] text-ink"
      />
      <p className="text-sm text-muted">{uploading ? "Uploading" : "A PNG, JPEG or WebP image, up to 8 MB."}</p>
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

/** Logos and text on the garment: upload, place, resize, turn, remove. Wiring and markup only. */
export function ArtworkControls(props: ArtworkControlsProps) {
  const { rows, errorFor, ...shared } = props;
  if (props.parts.length === 0) return <p className="text-[15px] text-muted">This garment has no part that can carry artwork.</p>;
  return (
    <div className="flex flex-col gap-6">
      <AddArtwork {...shared} errorFor={errorFor} />
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <ArtworkRowEditor key={row.id} row={row} error={errorFor(artworkKey(row.id))} {...shared} />
        ))}
      </ul>
    </div>
  );
}

type RowEditorProps = Readonly<{ row: ArtworkRow; error: string | null }> &
  Pick<ArtworkControlsProps, "spec" | "parts" | "onSave" | "onProblem" | "onClearProblem">;

function ArtworkRowEditor({ row, spec, parts, error, onSave, onProblem, onClearProblem }: RowEditorProps) {
  const key = artworkKey(row.id);
  const [fields, setFields] = useState(row.fields);
  const serverFields = JSON.stringify(row.fields);
  const [seen, setSeen] = useState(serverFields);
  // The design changed on the server, for example by an undo: what it holds replaces what is typed.
  if (seen !== serverFields) {
    setSeen(serverFields);
    setFields(row.fields);
  }

  const save = () => {
    const request = buildArtworkAction(spec, fields, row.id, "update");
    if (request.kind === "problem") return onProblem(key, request.reason);
    onClearProblem(key);
    onSave(key, request.action);
  };

  const remove = () => {
    const request = removeArtworkAction(row.id);
    if (request.kind === "action") onSave(key, request.action);
  };

  return (
    <li className="rounded-xl border border-hairline p-4">
      <p className="text-sm font-semibold text-ink">
        {row.name}
        <span className="ml-2 font-normal text-muted">
          {row.kindLabel} on {row.partLabel}, {row.placeLabel.toLowerCase()}
        </span>
      </p>
      <form
        aria-label={`Change ${row.name}`}
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <ArtworkFields spec={spec} parts={parts} form={fields} onChange={setFields} />
        <Problem id={`${row.id}-error`} message={error} />
        <RowButtons name={row.name} onRemove={remove} />
      </form>
    </li>
  );
}

function RowButtons({ name, onRemove }: Readonly<{ name: string; onRemove: () => void }>) {
  return (
    <div className="mt-4 flex gap-3">
      <Button type="submit" variant="secondary">
        Save changes
      </Button>
      <Button type="button" variant="quiet" aria-label={`Remove ${name}`} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
