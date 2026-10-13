"use client";

import { BASE_KEY, SIZES_KEY } from "@/components/studio/keys";
import { DetailsForm } from "@/components/studio/DetailsForm";
import { SizesForm } from "@/components/studio/SizesForm";
import type { CoverFormData } from "@/lib/projects/tech-pack-data";
import {
  codeField,
  colourwayFormAction,
  measurementFormActions,
  screenField,
  type ColourwayFormRow,
  type MeasurementFormRow,
} from "@/lib/projects/tech-pack-value-forms";
import { RowForm, type FormFieldSpec } from "./RowForm";
import { useTechPackEdit } from "./TechPackEdit";

/*
 * The forms for the cover, the measurement table and the colourways. They reuse the editor's
 * own forms and rules where they exist, so a value typed here means what it means there.
 */

const NOOP = () => undefined;

/** The style number, season and sizes. The details form is the editor's own; it saves outside the design's history. */
export function CoverForms({ projectId, cover }: Readonly<{ projectId: string; cover: CoverFormData }>) {
  const edit = useTechPackEdit();
  return (
    <div className="flex flex-col gap-6">
      <div data-field="cover:details">
        <h3 className="mb-3 text-sm font-semibold text-ink">Style number and season</h3>
        <DetailsForm projectId={projectId} name={cover.name} styleNumber={cover.styleNumber} season={cover.season} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-ink">Sizes</h3>
        <p className="mb-3 text-sm text-muted">
          {cover.sizesSet
            ? "These are the design's own sizes."
            : "The design has no sizes of its own yet. Until it has, the sizes of a size chart are used where one applies."}
        </p>
        <SizesForm
          initialText={cover.sizesText}
          initialBase={cover.baseSize}
          isSet={cover.sizesSet}
          busy={edit.busy}
          errorFor={edit.errorFor}
          onInvalid={edit.problem}
          onSave={edit.save}
          onTyping={() => {
            edit.clearProblem(SIZES_KEY);
            edit.clearProblem(BASE_KEY);
          }}
          onDirty={NOOP}
        />
      </div>
    </div>
  );
}

const measureFields = (row: MeasurementFormRow): readonly FormFieldSpec[] => [
  ...row.values.map((field) => ({ name: field.name, label: field.label, value: field.text })),
  {
    name: row.tolerance.name,
    label: row.tolerance.label,
    value: row.tolerance.text,
    hint: "How far a sample may be out, in either direction, for example 1.",
  },
];

/** A value for every size and the tolerance, one point of measure at a time. Lengths are in centimetres. */
export function MeasurementForms({ rows }: Readonly<{ rows: readonly MeasurementFormRow[] }>) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.pointId} className="rounded-xl border border-hairline p-4">
          <h4 className="mb-3 text-sm font-semibold text-ink">
            <span className="font-mono">{row.code}</span> {row.label}
          </h4>
          <RowForm
            formKey={`measurement:${row.pointId}`}
            title={`Measurements for ${row.label}`}
            description="Type centimetres, such as 52.5. Leave a field empty to keep what it has. Empty a value you typed to remove it."
            fields={measureFields(row)}
            submitLabel={`Save ${row.label.toLowerCase()}`}
            build={(typed) => measurementFormActions(row, typed)}
          />
        </li>
      ))}
    </ul>
  );
}

const colourFields = (row: ColourwayFormRow): readonly FormFieldSpec[] =>
  row.panels.flatMap((panel) => [
    { name: codeField(panel.panelId), label: `${panel.label}: colour code`, value: panel.code, hint: "The code your factory uses, for example Navy 19-4052." },
    { name: screenField(panel.panelId), label: `${panel.label}: screen colour`, value: panel.screen, hint: "Only for the drawing, as #rrggbb." },
  ]);

/** A colour code and a screen colour for each part, one colourway at a time. */
export function ColourwayForms({ rows }: Readonly<{ rows: readonly ColourwayFormRow[] }>) {
  const edit = useTechPackEdit();
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.colourwayId} className="rounded-xl border border-hairline p-4">
          <h4 className="mb-3 text-sm font-semibold text-ink">{row.name}</h4>
          <RowForm
            formKey={`colourway:${row.colourwayId}`}
            title={`Colours of ${row.name}`}
            description="Saving a colourway makes every colour in it your own."
            fields={colourFields(row)}
            submitLabel={`Save ${row.name}`}
            build={(typed) => colourwayFormAction(edit.working, row.colourwayId, typed)}
          />
        </li>
      ))}
    </ul>
  );
}
