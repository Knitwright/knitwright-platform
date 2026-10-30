"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import type { EditorSlotProps } from "@/lib/editor/slots";
import type { NamesNumbersForm } from "@/lib/projects/names-numbers-controls";
import { WhyButton } from "../WhyButton";
import { FONT_LIST_LABEL, KIT_FONTS, LICENCE_WORDS } from "./fonts";
import { RosterPreview } from "./RosterPreview";
import { namesNumbersView, removeRequest, saveRequest, setColour, setZoneHeight, toggleZone } from "./state";
import { METHOD_RULE, ZONES_LABEL } from "./zones";

/**
 * Names & numbers (spec F-S4, plan v5 Y8, decision 0081). A slot panel: it is given the design and
 * the shell's commands and nothing else, and it fetches nothing.
 *
 * The font list is a labelled placeholder, because Knitwright has licensed no kit-font kit; the
 * zones are the ones the base article fixes, each with the R-PER entry behind it; and the preview
 * shows the spec's own SMITH 7 without ever drawing it to a size.
 */
export default function NamesNumbers({ design, commands }: EditorSlotProps) {
  const [edited, setEdited] = useState<NamesNumbersForm | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const view = namesNumbersView(design.spec, design.colourwayId, edited ?? undefined);
  const form = view.form;

  if (!form) {
    return (
      <section aria-label="Names & numbers" data-testid="names-numbers-panel" className="glass flex flex-col gap-2 rounded-2xl p-5">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">Names &amp; numbers</h3>
        <p className="text-[13px] text-chalk-muted">This garment has no zone for a player name or number.</p>
      </section>
    );
  }

  const change = (next: NamesNumbersForm) => {
    setEdited(next);
    setProblem(null);
  };

  const save = () => {
    const request = saveRequest(form);
    if (request.kind === "problem") return setProblem(request.reason);
    setProblem(null);
    commands.save("names-numbers", request.action);
    commands.needsSimulation();
  };

  const remove = () => {
    const request = removeRequest();
    if (request.kind === "problem") return setProblem(request.reason);
    setEdited(null);
    setProblem(null);
    commands.save("names-numbers", request.action);
    commands.needsSimulation();
  };

  return (
    <section aria-label="Names & numbers" data-testid="names-numbers-panel" className="glass flex flex-col gap-5 rounded-2xl p-5">
      <header className="flex flex-col gap-1">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">Names &amp; numbers</h3>
        <p className="flex flex-wrap items-center gap-1 text-[13px] text-chalk-muted">
          Printed in the same pass as the rest of the design.
          <WhyButton ruleId={METHOD_RULE} context="names and numbers method" />
        </p>
      </header>

      <div className="flex flex-col gap-2" data-testid="names-numbers-zones">
        <h4 className="text-[13px] font-medium text-ink">Zones</h4>
        <p className="text-[13px] text-chalk-muted">{ZONES_LABEL}</p>
        <ul className="flex flex-col gap-3">
          {view.zones.map((zone) => (
            <li key={zone.place} className="flex flex-col gap-1 rounded-lg border border-white/10 p-3" data-testid={`names-numbers-zone-${zone.place}`}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-10 flex-1 items-center gap-2 text-[13px] text-ink">
                  <input type="checkbox" checked={zone.on} onChange={(event) => change(toggleZone(form, zone.place, event.currentTarget.checked))} className="size-4" />
                  {zone.label}
                </label>
                {zone.ruleMissing ? (
                  <span className="text-[11px] text-chalk-muted" data-testid={`names-numbers-gap-${zone.place}`}>
                    No rulebook entry yet
                  </span>
                ) : (
                  <WhyButton ruleId={zone.ruleId} context={`names and numbers zone ${zone.place}`} />
                )}
              </div>
              <p className="text-[11px] text-chalk-muted">{zone.anchorSentence}</p>
              {zone.on ? (
                <Field
                  name={`height-${zone.place}`}
                  label="Height in centimetres (optional)"
                  inputMode="decimal"
                  value={zone.heightCm}
                  onChange={(event) => change(setZoneHeight(form, zone.place, event.currentTarget.value))}
                  hint="Left empty it stays for the factory to give, and is never guessed."
                />
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2" data-testid="names-numbers-fonts">
        <h4 className="text-[13px] font-medium text-ink">Font</h4>
        <p className="text-[13px] text-chalk-muted">{FONT_LIST_LABEL}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {KIT_FONTS.map((font) => (
            <li key={font.id}>
              <button
                type="button"
                aria-pressed={form.style === font.style}
                onClick={() => change({ ...form, style: font.style })}
                data-testid={`names-numbers-font-${font.id}`}
                data-licence={font.licence}
                className={`flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border p-3 text-left ${
                  form.style === font.style ? "border-white/40 bg-tile-2" : "border-white/10 hover:bg-tile-2/60"
                }`}
              >
                <span className="text-[13px] text-ink">{font.name}</span>
                <span className="text-[11px] text-chalk-muted">{LICENCE_WORDS[font.licence]}</span>
              </button>
            </li>
          ))}
        </ul>
        {view.font ? <p className="text-[11px] text-chalk-muted">{view.font.licenceNote}</p> : null}
      </div>

      <div className="flex flex-col gap-3" data-testid="names-numbers-colours">
        <h4 className="text-[13px] font-medium text-ink">Colour and outline</h4>
        {view.roles.length > 0 ? (
          <SelectField
            name="role"
            label="Take the colour from"
            placeholder="Type my own"
            options={view.roles}
            value={view.roles.some((role) => role.id === view.colour) ? view.colour : ""}
            onChange={(event) => change(setColour(form, event.currentTarget.value, view.outline))}
          />
        ) : null}
        <Field name="colour" label="Lettering colour" value={view.colour} onChange={(event) => change(setColour(form, event.currentTarget.value, view.outline))} />
        <Field
          name="outline"
          label="Outline (optional)"
          value={view.outline}
          onChange={(event) => change(setColour(form, view.colour, event.currentTarget.value))}
          hint="A colour like #ffffff, or a name the factory matches. An outline helps lettering read on a patterned back."
        />
        <Field name="swatch" label="Colour on screen" type="color" value={view.preview.fill} onChange={(event) => change({ ...form, swatch: event.currentTarget.value })} />
      </div>

      <div className="flex flex-col gap-3" data-testid="names-numbers-sample">
        <h4 className="text-[13px] font-medium text-ink">Preview</h4>
        <div className="flex flex-wrap gap-3">
          <Field name="sampleName" label="Sample name" value={form.sampleName} onChange={(event) => change({ ...form, sampleName: event.currentTarget.value })} />
          <Field name="sampleNumber" label="Sample number" value={form.sampleNumber} onChange={(event) => change({ ...form, sampleNumber: event.currentTarget.value })} />
        </div>
        <p className="text-[13px] text-chalk-muted">Each player&apos;s own name and number come with the team order.</p>
        <RosterPreview view={view.preview} />
      </div>

      {problem ? (
        <p role="alert" className="rounded-lg bg-warn-wash px-3 py-2 text-[13px] text-warn" data-testid="names-numbers-problem">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={design.busy}>
          Save names &amp; numbers
        </Button>
        {view.set ? (
          <Button type="button" variant="secondary" onClick={remove} disabled={design.busy}>
            Take them off
          </Button>
        ) : null}
      </div>
    </section>
  );
}
