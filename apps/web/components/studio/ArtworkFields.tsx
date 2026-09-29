"use client";

import { useId } from "react";
import { ANCHOR_CHOICES, TECHNIQUE_CHOICES, withPart, type ArtworkForm, type Part } from "@/lib/projects/artwork-controls";
import type { GarmentSpec } from "@/lib/garment";

const INPUT = "h-11 min-w-0 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink";

type FieldsProps = Readonly<{
  spec: GarmentSpec;
  parts: readonly Part[];
  form: ArtworkForm;
  onChange: (next: ArtworkForm) => void;
}>;

type TextFieldProps = Readonly<{ label: string; value: string; onChange: (value: string) => void; inputMode?: "decimal" | "numeric" }>;

function TextField({ label, value, onChange, inputMode }: TextFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input id={id} type="text" inputMode={inputMode} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} className={INPUT} />
    </div>
  );
}

type ChoiceFieldProps = Readonly<{
  label: string;
  value: string;
  choices: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}>;

function ChoiceField({ label, value, choices, onChange }: ChoiceFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT}>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The fields for one piece of artwork. Number fields and lists, with no dragging. Markup and wiring only. */
export function ArtworkFields({ spec, parts, form, onChange }: FieldsProps) {
  const set = (patch: Partial<ArtworkForm>) => onChange({ ...form, ...patch });
  const words = form.source.kind === "text" ? form.source.text : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Name" value={form.name} onChange={(name) => set({ name })} />
      {words !== null ? <TextField label="Words to print" value={words} onChange={(text) => set({ source: { kind: "text", text } })} /> : null}
      <ChoiceField
        label="Part of the garment"
        value={form.panelId}
        choices={parts.map((part) => ({ id: part.panelId, label: part.label }))}
        onChange={(panelId) => onChange(withPart(spec, form, panelId))}
      />
      <ChoiceField label="Place on the part" value={form.anchorId} choices={ANCHOR_CHOICES(spec, form.panelId)} onChange={(anchorId) => set({ anchorId })} />
      <TextField label="Width (cm)" inputMode="decimal" value={form.widthCm} onChange={(widthCm) => set({ widthCm })} />
      <TextField label="Height (cm)" inputMode="decimal" value={form.heightCm} onChange={(heightCm) => set({ heightCm })} />
      <TextField label="Move across (cm)" inputMode="decimal" value={form.offsetXCm} onChange={(offsetXCm) => set({ offsetXCm })} />
      <TextField label="Move down (cm)" inputMode="decimal" value={form.offsetYCm} onChange={(offsetYCm) => set({ offsetYCm })} />
      <TextField label="Turn (degrees)" inputMode="numeric" value={form.rotation} onChange={(rotation) => set({ rotation })} />
      <ChoiceField label="How it is made" value={form.technique} choices={TECHNIQUE_CHOICES} onChange={(technique) => set({ technique })} />
    </div>
  );
}
