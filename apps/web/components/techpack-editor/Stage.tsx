"use client";

import { Play, Ruler, Trash2 } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextInput } from "@/components/ui/Inputs";
import { Popover } from "@/components/ui/Popover";
import type { FitReport } from "@/lib/techpack/editor/fit";
import { STAGE_BOX, stagePointFrom, type StageCallout, type StagePoints } from "@/lib/techpack/editor/stage";
import type { PickedPoint } from "@/lib/techpack/view/marks";
import { Garment, StageMarks, type StageSelection } from "./StageMarks";

/**
 * The stage of the tech pack view (spec screen 30): the garment with its red measurement points and
 * blue numbered callouts, the selected mark's chip with its delete, **Check fit** top right, and the
 * size the tables highlight bottom left. While "Add callout on the 3D view" is on, a press on the
 * garment places a new callout there and asks for its note.
 */

type Props = Readonly<{
  points: StagePoints;
  callouts: readonly StageCallout[];
  selection: StageSelection;
  onSelect: (selection: StageSelection) => void;
  fit: FitReport;
  sizes: readonly string[];
  size: string;
  onSize: (size: string) => void;
  /** True while a press on the garment places a callout. */
  placing: boolean;
  onPlace: (point: PickedPoint, note: string) => void;
  onCancelPlace: () => void;
  /** Takes a founder's own callout off. Null where nothing can be saved. */
  onRemoveCallout: ((markId: string) => void) | null;
  busy: boolean;
}>;

function chipText(selection: StageSelection): string | null {
  if (selection === null) return null;
  return selection.kind === "point" ? `Measurement · ${selection.letter}` : `Callout · ${selection.number}`;
}

/** Where a press fell in the drawing, as a fraction of the box, whatever size the drawing is shown at. */
function fractionOf(event: MouseEvent<SVGSVGElement>): readonly [number, number] {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM?.();
  if (!matrix) {
    const box = svg.getBoundingClientRect();
    return [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height];
  }
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [point.x / STAGE_BOX.width, point.y / STAGE_BOX.height];
}

export function Stage(props: Props) {
  const { points, callouts, selection, onSelect, placing } = props;
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const chip = chipText(selection);
  const removable = selection?.kind === "callout" ? (callouts.find((entry) => entry.number === selection.number)?.markId ?? null) : null;
  const pressStage = (event: MouseEvent<SVGSVGElement>) => {
    if (!placing) return onSelect(null);
    const [x, y] = fractionOf(event);
    setPicked(stagePointFrom(x, y));
  };
  return (
    <section
      aria-label="Garment with measurement points and callouts"
      className="relative flex min-h-120 flex-1 flex-col overflow-hidden rounded-2xl bg-muted"
      data-testid="tp-stage"
    >
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-end gap-3 [&>*]:pointer-events-auto">
        {chip ? (
          <span
            className="mr-auto ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-bg px-4 text-body font-semibold text-text shadow-e1"
            data-testid="tp-stage-chip"
          >
            {chip}
            {removable && props.onRemoveCallout ? (
              <Button
                variant="ghost"
                size="md"
                iconOnly
                aria-label={`Delete ${chip}`}
                icon={<Icon icon={Trash2} size={16} />}
                disabled={props.busy}
                onClick={() => props.onRemoveCallout?.(removable)}
              />
            ) : null}
          </span>
        ) : null}
        <FitCheck fit={props.fit} />
      </div>
      <svg
        viewBox={`0 0 ${STAGE_BOX.width} ${STAGE_BOX.height}`}
        role="group"
        aria-label={placing ? "Press where the new callout goes" : "Garment, front view"}
        onClick={pressStage}
        className={`m-auto h-full max-h-180 w-full flex-1 px-6 pt-16 pb-20 ${placing ? "cursor-crosshair" : ""}`}
        data-testid="tp-stage-drawing"
      >
        <Garment />
        <StageMarks points={points.drawn} callouts={callouts} selection={selection} onSelect={onSelect} />
      </svg>
      {placing ? (
        <PlaceCallout
          picked={picked}
          busy={props.busy}
          onKeep={(note) => {
            if (picked) props.onPlace(picked, note);
            setPicked(null);
          }}
          onCancel={() => {
            setPicked(null);
            props.onCancelPlace();
          }}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-2 [&>*]:pointer-events-auto">
        <SizePicker sizes={props.sizes} size={props.size} onSize={props.onSize} />
        {points.notDrawn.length > 0 ? (
          <p className="rounded-md bg-bg px-3 py-1.5 text-caption text-text-2" data-testid="tp-not-drawn">
            Not drawn on the garment: {points.notDrawn.join(", ")}. Their values are in the tables.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SizePicker({
  sizes,
  size,
  onSize,
}: Readonly<{
  sizes: readonly string[];
  size: string;
  onSize: (size: string) => void;
}>) {
  if (sizes.length === 0) return <span />;
  return (
    <label className="inline-flex h-11 items-center gap-2 rounded-lg bg-bg px-3 text-body font-semibold text-text shadow-e1">
      <Icon icon={Ruler} size={16} />
      <span>Size</span>
      <select
        value={size}
        onChange={(event) => onSize(event.target.value)}
        className="rounded-sm bg-transparent font-semibold outline-none focus-visible:ring-2 focus-visible:ring-electric"
        data-testid="tp-size"
      >
        {sizes.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>
    </label>
  );
}

function FitCheck({ fit }: Readonly<{ fit: FitReport }>) {
  return (
    <Popover label="Check fit" title="Fit of the size run" variant="primary" icon={<Icon icon={Play} size={16} />} width={400}>
      <div className="flex flex-col gap-3 p-4" data-testid="tp-fit">
        <p className="text-body font-semibold text-text">{fit.summary}</p>
        <ul tabIndex={0} aria-label="Each point of measure" className="flex max-h-80 flex-col gap-1.5 overflow-y-auto rounded-sm focus-visible:ring-2 focus-visible:ring-electric">
          {fit.lines.map((line) => (
            <li key={line.letter} className="flex gap-2 text-small text-text-2">
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full text-micro font-bold text-on-dark ${line.state === "ok" ? "bg-ok" : "bg-warn"}`}
              >
                {line.letter}
              </span>
              <span>
                <span className="font-semibold text-text">{line.description}</span> — {line.detail}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-muted">Read from the base article&apos;s graded size run. Nothing here is measured on a body.</p>
      </div>
    </Popover>
  );
}

type PlaceProps = Readonly<{
  picked: PickedPoint | null;
  busy: boolean;
  onKeep: (note: string) => void;
  onCancel: () => void;
}>;

function PlaceCallout({ picked, busy, onKeep, onCancel }: PlaceProps) {
  const [note, setNote] = useState("");
  return (
    <form
      className="absolute inset-x-4 bottom-20 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-bg p-3 shadow-e2"
      onSubmit={(event) => {
        event.preventDefault();
        if (picked && note.trim() !== "") onKeep(note.trim());
      }}
      data-testid="tp-place-callout"
    >
      {picked ? (
        <>
          <label htmlFor="tp-callout-note" className="sr-only">
            The callout&apos;s note
          </label>
          <TextInput
            id="tp-callout-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder="What should the factory know here?"
            className="min-w-0 flex-1"
            autoFocus
          />
          <Button type="submit" size="md" disabled={busy || note.trim() === ""}>
            Add callout
          </Button>
        </>
      ) : (
        <p className="flex-1 text-small text-text-2">Press the garment where the callout goes.</p>
      )}
      <Button variant="secondary" size="md" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
