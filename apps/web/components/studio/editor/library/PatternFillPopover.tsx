"use client";

import { useId, useState } from "react";
import type { EditorSlotProps } from "@/lib/editor/slots";
import { runSteps } from "@/lib/panel-layers/apply";
import { fillView, removeFill, setFillColour, setFillValue, type FillField } from "@/lib/panel-layers/pattern-fill";
import { WhyButton } from "../WhyButton";

/**
 * The pattern-fill popover of spec F-S4 (plan v5 Y3, decision 0076): the fill's colours, its sizes
 * in millimetres with a ratio lock, apply to all, and delete.
 *
 * Every control is one of the style's own declared settings, drawn between the minimum and maximum
 * that style states, so a value it cannot take cannot be reached. A control the spec asks for that
 * a design has no field for is shown as a line of words with its Why?, never as a slider that does
 * nothing: `lib/panel-layers/pattern-fill.ts` decides which is which.
 */
export function PatternFillPopover({ design, commands }: EditorSlotProps) {
  const view = fillView(design);
  const [locked, setLocked] = useState(true);
  const [said, setSaid] = useState<string | null>(null);
  const lockId = useId();

  if (view === null) {
    return (
      <p className="text-[13px] text-chalk-muted" data-testid="pattern-fill-none">
        This design has no pattern fill. Pick one from Pattern fills above to put a printed style over the body colour.
      </p>
    );
  }
  return (
    <section aria-label="Pattern fill" data-testid="pattern-fill" className="flex flex-col gap-3 rounded-2xl border border-white/10 p-3">
      <h3 className="text-[13px] font-medium text-ink">{view.styleLabel}</h3>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-mono text-[11px] tracking-[0.08em] text-chalk-muted uppercase">Colours, up to {view.maxColours}</legend>
        {view.colours.map((colour, at) => (
          <ColourField
            key={`${at}-${colour.swatch ?? colour.colour}`}
            at={at}
            swatch={colour.swatch ?? "#101c3d"}
            reference={colour.colour}
            busy={design.busy}
            onSet={(value) => setSaid(runSteps(setFillColour(design, at, value), commands))}
          />
        ))}
      </fieldset>

      {view.fields.length === 0 ? (
        <p className="text-[11px] text-chalk-muted">Nobody has given this style a size yet, so there is nothing to change here.</p>
      ) : (
        <>
          <label htmlFor={lockId} className="flex min-h-10 items-center gap-2 text-[12px] text-ink">
            <input id={lockId} type="checkbox" checked={locked} disabled={view.lockable.length < 2} onChange={(event) => setLocked(event.target.checked)} className="size-4 accent-cobalt" />
            Keep the sizes in ratio
          </label>
          {view.fields.map((field) => (
            <Field key={field.id} field={field} busy={design.busy} onSet={(value) => setSaid(runSteps(setFillValue(design, field.id, value, locked), commands))} />
          ))}
        </>
      )}

      <ul className="flex flex-col gap-1">
        {view.unstored.map((entry) => (
          <li key={entry.label} className="flex flex-wrap items-center gap-1 text-[11px] text-chalk-muted">
            <span className="font-medium text-ink">{entry.label}:</span> {entry.reason}
            <WhyButton ruleId={entry.ruleId} context={`pattern fill ${entry.label}`} />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {view.targets.map((target) => (
          <span key={target.kind} className="text-[11px] text-chalk-muted">
            {target.label}
            {target.reason === null ? ": the pattern is already on the whole body." : `: ${target.reason}`}
          </span>
        ))}
      </div>

      <button
        type="button"
        disabled={design.busy}
        onClick={() => setSaid(runSteps(removeFill(design), commands))}
        className="chip-btn min-h-10 self-start rounded-full border border-white/20 px-4 text-[13px] font-medium text-ink"
      >
        Delete the pattern fill
      </button>
      <p role="status" className="text-[12px] text-ink empty:hidden">
        {said}
      </p>
    </section>
  );
}

function Field({ field, busy, onSet }: Readonly<{ field: FillField; busy: boolean; onSet: (value: number | boolean) => void }>) {
  const id = useId();
  if (field.unit === "yes-no") {
    return (
      <label htmlFor={id} className="flex min-h-10 items-center gap-2 text-[12px] text-ink">
        <input id={id} type="checkbox" checked={field.value === true} disabled={busy} onChange={(event) => onSet(event.target.checked)} className="size-4 accent-cobalt" />
        {field.label}
      </label>
    );
  }
  const value = typeof field.value === "number" ? field.value : field.min;
  return (
    <div className="flex flex-col gap-1" data-testid={`pattern-fill-${field.id}`}>
      <label htmlFor={id} className="text-[12px] text-ink">
        {field.label}: {field.value === null ? "not set" : `${value} mm`} · range {field.min} to {field.max} mm
      </label>
      <input
        id={id}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        defaultValue={value}
        disabled={busy}
        onBlur={(event) => onSet(Number(event.target.value))}
        className="min-h-10 rounded-full border border-white/20 bg-transparent px-3 text-[13px] text-ink"
      />
    </div>
  );
}

type ColourProps = Readonly<{ at: number; swatch: string; reference: string; busy: boolean; onSet: (swatch: string) => void }>;

function ColourField({ at, swatch, reference, busy, onSet }: ColourProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="flex-1 text-[12px] text-ink">
        Colour {at + 1}
        {reference === "" ? <span className="block text-[11px] text-chalk-muted">Screen colour only. Your factory matches the reference your brand gives.</span> : <span className="block text-[11px] text-chalk-muted">{reference}</span>}
      </label>
      <input id={id} type="color" value={swatch} disabled={busy} onChange={(event) => onSet(event.target.value)} className="size-10 rounded-full border border-white/20 bg-transparent" />
    </div>
  );
}
