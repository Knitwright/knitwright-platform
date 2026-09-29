"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { GarmentSpec, SpecAction } from "@/lib/garment";
import {
  buildArtworkAction,
  removeArtworkAction,
  type ArtworkRow,
  type Part,
} from "@/lib/projects/artwork-controls";
import { AddArtwork } from "./ArtworkAdd";
import { ArtworkFields, Problem } from "./ArtworkFields";
import { artworkKey } from "./keys";

export type ArtworkControlsProps = Readonly<{
  /** The design as it will be once waiting changes are saved. */
  spec: GarmentSpec;
  rows: readonly ArtworkRow[];
  parts: readonly Part[];
  errorFor: (key: string) => string | null;
  onSave: (key: string, action: SpecAction) => void;
  onProblem: (key: string, message: string) => void;
  onClearProblem: (key: string) => void;
}>;

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
