"use client";

import { useId, useState } from "react";
import type { EditorSlotProps } from "@/lib/editor/slots";
import { runSteps } from "@/lib/panel-layers/apply";
import {
  centreOnAnchor,
  graphicActionsNotWired,
  graphicView,
  removeGraphic,
  setGraphicAnchor,
  setGraphicNumber,
  setGraphicTechnique,
  type GraphicNumber,
} from "@/lib/panel-layers/graphic-edit";
import { unknownDecorationProfile } from "@/lib/panel-layers/techniques";
import { WhyButton } from "../WhyButton";

/**
 * The Edit Graphic panel of spec F-S4 (plan v5 Y3, decision 0076): the name, Remove background,
 * Convert to pattern fill, the type, the size in millimetres, the position in millimetres from the
 * panel's anchor, rotation, align and delete.
 *
 * A method the factory profile does not list is shown locked with its reason and a Why?, exactly as
 * the Form toolbar locks an option no sample has approved. Remove background and Convert to pattern
 * fill are seams, not buttons that pretend: each says plainly that it is not wired, and neither can
 * put a picture on a panel. The size, position and rotation are the only things stored, because they
 * are the only things a design holds.
 */
export function EditGraphicPanel({ design, commands, artworkId }: EditorSlotProps & Readonly<{ artworkId: string }>) {
  const view = graphicView(design, artworkId, unknownDecorationProfile());
  const [said, setSaid] = useState<string | null>(null);

  if (view === null) {
    return (
      <p className="text-[13px] text-chalk-muted" data-testid="edit-graphic-none">
        That graphic is not on this design any more.
      </p>
    );
  }
  return (
    <section aria-label="Edit graphic" data-testid="edit-graphic" className="flex flex-col gap-3 rounded-2xl border border-white/10 p-3">
      <header className="flex flex-col gap-1">
        <h3 className="text-[13px] font-medium text-ink">{view.name}</h3>
        <p className="text-[11px] text-chalk-muted">
          {view.source}, on {view.panelLabel}.
        </p>
      </header>

      <fieldset className="flex flex-col gap-1">
        <legend className="font-mono text-[11px] tracking-[0.08em] text-chalk-muted uppercase">Type</legend>
        {view.techniques.map((choice) => (
          <div key={choice.technique}>
            <label className="flex min-h-10 items-center gap-2 text-[13px] text-ink">
              <input
                type="radio"
                name={`${view.id}-technique`}
                value={choice.technique}
                checked={choice.chosen}
                disabled={design.busy || choice.lockNote !== null}
                onChange={() => setSaid(runSteps(setGraphicTechnique(design, view.id, choice.technique, unknownDecorationProfile()), commands))}
                className="size-4 accent-cobalt"
              />
              {choice.label}
            </label>
            {choice.lockNote === null ? null : (
              <p className="ml-6 flex flex-wrap items-center gap-1 text-[11px] text-warn">
                <span aria-hidden="true">&#128274;</span> {choice.lockNote}.
                <WhyButton ruleId={choice.ruleId} context={`graphic technique ${choice.technique}`} />
              </p>
            )}
          </div>
        ))}
      </fieldset>

      <Numbers view={view} busy={design.busy} onSet={(id, value, lock) => setSaid(runSteps(setGraphicNumber(design, view.id, id, value, lock), commands))} />

      <AnchorPicker
        anchors={view.anchors}
        busy={design.busy}
        onPick={(anchorId) => setSaid(runSteps(setGraphicAnchor(design, view.id, anchorId), commands))}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={design.busy}
          onClick={() => setSaid(runSteps(centreOnAnchor(design, view.id), commands))}
          className="chip-btn min-h-10 rounded-full border border-white/20 px-4 text-[13px] font-medium text-ink"
        >
          Centre on the anchor
        </button>
        <button
          type="button"
          disabled={design.busy}
          onClick={() => setSaid(runSteps(removeGraphic(design, view.id), commands))}
          className="chip-btn min-h-10 rounded-full border border-white/20 px-4 text-[13px] font-medium text-ink"
        >
          Delete
        </button>
      </div>
      <p className="text-[11px] text-chalk-muted">{view.alignNote}</p>

      <ul className="flex flex-col gap-1">
        {[...graphicActionsNotWired(), ...view.unstored].map((entry) => (
          <li key={entry.label} className="flex flex-wrap items-center gap-1 text-[11px] text-chalk-muted">
            <span className="font-medium text-ink">{entry.label}:</span> {entry.reason}
            <WhyButton ruleId={entry.ruleId} context={`graphic ${entry.label}`} />
          </li>
        ))}
      </ul>

      <p role="status" className="text-[12px] text-ink empty:hidden">
        {said}
      </p>
    </section>
  );
}

type NumbersProps = Readonly<{
  view: NonNullable<ReturnType<typeof graphicView>>;
  busy: boolean;
  onSet: (id: GraphicNumber["id"], value: number, lock: boolean) => void;
}>;

function Numbers({ view, busy, onSet }: NumbersProps) {
  const lockId = useId();
  const [locked, setLocked] = useState(true);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={lockId} className="flex min-h-10 items-center gap-2 text-[12px] text-ink">
        <input id={lockId} type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} className="size-4 accent-cobalt" />
        Keep the shape when the size changes
      </label>
      {view.numbers.map((number) => (
        <NumberField key={number.id} number={number} busy={busy} onSet={(value) => onSet(number.id, value, locked)} />
      ))}
    </div>
  );
}

function NumberField({ number, busy, onSet }: Readonly<{ number: GraphicNumber; busy: boolean; onSet: (value: number) => void }>) {
  const id = useId();
  return (
    <div className="flex items-center gap-2" data-testid={`edit-graphic-${number.id}`}>
      <label htmlFor={id} className="flex-1 text-[12px] text-ink">
        {number.label} ({number.unit})
      </label>
      <input
        id={id}
        type="number"
        step={number.unit === "degrees" ? 1 : 0.1}
        defaultValue={number.value}
        disabled={busy}
        onBlur={(event) => onSet(Number(event.target.value))}
        className="min-h-10 w-28 rounded-full border border-white/20 bg-transparent px-3 text-[13px] text-ink"
      />
    </div>
  );
}

type AnchorProps = Readonly<{ anchors: NonNullable<ReturnType<typeof graphicView>>["anchors"]; busy: boolean; onPick: (anchorId: string) => void }>;

function AnchorPicker({ anchors, busy, onPick }: AnchorProps) {
  const id = useId();
  if (anchors.length === 0) return <p className="text-[11px] text-chalk-muted">This panel has no named places on file, so the graphic stays where it is.</p>;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="flex-1 text-[12px] text-ink">
        Measured from
      </label>
      <select
        id={id}
        value={anchors.find((anchor) => anchor.chosen)?.id ?? ""}
        disabled={busy}
        onChange={(event) => onPick(event.target.value)}
        className="min-h-10 flex-1 rounded-full border border-white/20 bg-transparent px-3 text-[12px] text-ink"
      >
        {anchors.map((anchor) => (
          <option key={anchor.id} value={anchor.id}>
            {anchor.label}
          </option>
        ))}
      </select>
    </div>
  );
}
