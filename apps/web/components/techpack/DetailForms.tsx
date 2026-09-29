"use client";

import {
  SEAM_CLASS_CHOICES,
  STITCH_CLASS_CHOICES,
  componentAction,
  constructionAction,
  labellingAction,
  type ComponentRow,
  type LabellingFormRow,
  type SeamRow,
} from "@/lib/projects/tech-pack-forms";
import { RowForm } from "./RowForm";

/** Thread, labels, rib and trims. One small form for each thing the design implies. */
export function ComponentForms({ rows }: Readonly<{ rows: readonly ComponentRow[] }>) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.slotId} className="rounded-xl border border-hairline p-4">
          <h4 className="text-sm font-semibold text-ink">
            {row.label} <span className="font-normal text-muted">({row.kindLabel})</span>
          </h4>
          <RowForm
            formKey={`component:${row.slotId}`}
            title={`Details for ${row.label}`}
            description={row.help}
            fields={[
              { name: "name", label: `Name of ${row.label.toLowerCase()}`, value: row.values.name },
              { name: "details", label: `Details of ${row.label.toLowerCase()}`, value: row.values.details },
              {
                name: "quantity",
                label: `Quantity of ${row.label.toLowerCase()}`,
                value: row.values.quantity,
                hint: "Write the amount with its unit, for example 4 per garment. Leave it empty until you know it.",
              },
            ]}
            submitLabel={`Save ${row.label}`}
            build={(typed) =>
              componentAction(
                row.slotId,
                { name: typed.name ?? "", details: typed.details ?? "", quantity: typed.quantity ?? "" },
                row.hasEntry,
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}

/** For each seam: change the kind of seam or stitch the registry proposes, and enter the stitch density. */
export function SeamForms({ rows }: Readonly<{ rows: readonly SeamRow[] }>) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.seamId} className="rounded-xl border border-hairline p-4">
          <h4 className="text-sm font-semibold text-ink">{row.label}</h4>
          <p className="mb-3 text-sm text-muted">Joins {row.panels}.</p>
          <RowForm
            formKey={`seam:${row.seamId}`}
            title={`Stitching for ${row.label}`}
            fields={[
              {
                name: "seamClass",
                label: `Seam class of ${row.label.toLowerCase()}`,
                value: row.values.seamClass,
                choices: [{ id: "", label: `Use the proposal: ${row.proposal.seamClass}` }, ...SEAM_CLASS_CHOICES],
              },
              {
                name: "stitchClass",
                label: `Stitch class of ${row.label.toLowerCase()}`,
                value: row.values.stitchClass,
                choices: [{ id: "", label: `Use the proposal: ${row.proposal.stitchClass}` }, ...STITCH_CLASS_CHOICES],
              },
              {
                name: "stitchDensity",
                label: `Stitch density of ${row.label.toLowerCase()}`,
                value: row.values.stitchDensity,
                hint: "Write it with its unit, as your factory does. Leave it empty until you know it.",
              },
            ]}
            submitLabel={`Save ${row.label}`}
            build={(typed) =>
              constructionAction(
                row.seamId,
                {
                  seamClass: typed.seamClass ?? "",
                  stitchClass: typed.stitchClass ?? "",
                  stitchDensity: typed.stitchDensity ?? "",
                },
                row.hasEntry,
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}

/** Care, composition, country of origin, how to fold and how to bag. One line each. */
export function LabellingForms({ rows }: Readonly<{ rows: readonly LabellingFormRow[] }>) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.field} className="rounded-xl border border-hairline p-4">
          <RowForm
            formKey={`labelling:${row.field}`}
            title={row.label}
            fields={[{ name: "text", label: row.label, value: row.text }]}
            submitLabel={`Save ${row.label.toLowerCase()}`}
            build={(typed) => labellingAction(row.field, typed.text ?? "", row.text !== "")}
          />
        </li>
      ))}
    </ul>
  );
}
