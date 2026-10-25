"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SpecAction } from "@/lib/garment";
import {
  LETTERING_CHOICES,
  NO_PLACES_FOR_MARKS,
  TECHNIQUE_CHOICES,
  buildNamesNumbersAction,
  removeNamesNumbersAction,
  type NamesNumbersForm,
  type NamesNumbersPanel,
} from "@/lib/projects/names-numbers-controls";
import { ChoiceField, Problem, TextField } from "./ArtworkFields";
import { NAMES_NUMBERS_KEY } from "./keys";

type Props = Readonly<{
  panel: NamesNumbersPanel | null;
  error: string | null;
  onSave: (key: string, action: SpecAction) => void;
  onProblem: (key: string, message: string) => void;
  onClearProblem: (key: string) => void;
}>;

const LATER = { id: "", label: "Choose later" };

/** Player names and numbers: places, lettering, colour and a sample. Rules live in lib/projects. */
export function NamesNumbersControls({ panel, error, onSave, onProblem, onClearProblem }: Props) {
  const [form, setForm] = useState<NamesNumbersForm | null>(panel?.form ?? null);
  const serverForm = JSON.stringify(panel?.form ?? null);
  const [seen, setSeen] = useState(serverForm);
  // The design changed on the server, for example by an undo: what it holds replaces what is typed.
  if (seen !== serverForm) {
    setSeen(serverForm);
    setForm(panel?.form ?? null);
  }
  if (!panel || !form) return <p className="text-[15px] text-muted">{NO_PLACES_FOR_MARKS}</p>;

  const set = (patch: Partial<NamesNumbersForm>) => setForm({ ...form, ...patch });
  const save = () => {
    const request = buildNamesNumbersAction(form);
    if (request.kind === "problem") return onProblem(NAMES_NUMBERS_KEY, request.reason);
    onClearProblem(NAMES_NUMBERS_KEY);
    onSave(NAMES_NUMBERS_KEY, request.action);
  };
  const remove = () => {
    const request = removeNamesNumbersAction();
    if (request.kind === "action") onSave(NAMES_NUMBERS_KEY, request.action);
  };

  return (
    <form
      aria-label="Player names and numbers"
      data-testid="names-numbers"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <p className="mb-4 text-[15px] leading-relaxed text-muted">
        Each player picks their own name and number when the team orders. Here you choose where they go and how they
        look. The drawing shows your sample. Leave a height empty if you do not know it yet.
      </p>
      <PlaceFields form={form} labels={panel.placeLabels} onChange={set} />
      <div className="mt-4 grid gap-3 @md:grid-cols-2">
        <ChoiceField label="Lettering style" value={form.style} choices={[LATER, ...LETTERING_CHOICES]} onChange={(style) => set({ style })} />
        <ChoiceField label="How it is made" value={form.technique} choices={[LATER, ...TECHNIQUE_CHOICES]} onChange={(technique) => set({ technique })} />
        <TextField label="Colour name or code" value={form.colour} onChange={(colour) => set({ colour })} />
        <TextField label="Drawn colour, such as #1b2a49" value={form.swatch} onChange={(swatch) => set({ swatch })} />
        <TextField label="Sample name" value={form.sampleName} onChange={(sampleName) => set({ sampleName })} />
        <TextField label="Sample number" value={form.sampleNumber} inputMode="numeric" onChange={(sampleNumber) => set({ sampleNumber })} />
      </div>
      <Problem id="names-numbers-error" message={error} />
      <div className="mt-4 flex gap-3">
        <Button type="submit" variant="secondary">
          {panel.set ? "Save changes" : "Add names and numbers"}
        </Button>
        {panel.set ? (
          <Button type="button" variant="quiet" onClick={remove}>
            Remove names and numbers
          </Button>
        ) : null}
      </div>
    </form>
  );
}

type PlaceProps = Readonly<{ form: NamesNumbersForm; labels: Readonly<Record<string, string>>; onChange: (patch: Partial<NamesNumbersForm>) => void }>;

function PlaceFields({ form, labels, onChange }: PlaceProps) {
  const update = (index: number, patch: Partial<NamesNumbersForm["places"][number]>) =>
    onChange({ places: form.places.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)) });
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium text-ink">Places</legend>
      {form.places.map((entry, index) => (
        <PlaceRow key={entry.place} label={labels[entry.place] ?? entry.place} entry={entry} onChange={(patch) => update(index, patch)} />
      ))}
    </fieldset>
  );
}

type RowProps = Readonly<{
  label: string;
  entry: NamesNumbersForm["places"][number];
  onChange: (patch: Partial<NamesNumbersForm["places"][number]>) => void;
}>;

function PlaceRow({ label, entry, onChange }: RowProps) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-h-10 min-w-[16rem] items-center gap-2 text-[15px] text-ink">
        <input type="checkbox" checked={entry.on} onChange={(event) => onChange({ on: event.target.checked })} />
        {label}
      </label>
      <label htmlFor={id} className="sr-only">
        Height for {label.toLowerCase()}, in centimetres
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Height in cm"
        disabled={!entry.on}
        value={entry.heightCm}
        onChange={(event) => onChange({ heightCm: event.target.value })}
        className="h-11 w-36 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink"
      />
    </div>
  );
}
