"use client";

import { FlatPreview } from "@/components/studio/FlatPreview";
import { plain } from "@/lib/copy/vocabulary";
import { previewRows, previewTitle } from "@/lib/guided/preview";
import type { EditorData } from "@/lib/projects/editor-data";
import type { LengthUnit } from "@/lib/units/length";

type Props = Readonly<{ data: EditorData; unit: LengthUnit; onUnit: (unit: LengthUnit) => void; show3d?: boolean }>;

const UNITS: readonly { id: LengthUnit; label: string }[] = [
  { id: "cm", label: "Centimetres" },
  { id: "in", label: "Inches" },
];

/**
 * The drawing and the measurements together, beside every step, so each change is seen in both
 * at once (plan step 15, task 2). Inches are for reading: the design keeps centimetres.
 */
export function LivePreview({ data, unit, onUnit, show3d = false }: Props) {
  const rows = previewRows(data.table, unit);
  return (
    <div className="flex flex-col gap-6" data-testid="live-preview">
      <FlatPreview flat={data.flat} show3d={show3d} />
      <section aria-labelledby="preview-measurements" className="rounded-2xl border border-hairline bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="preview-measurements" className="text-base font-semibold text-ink">
            {previewTitle(data.table)}
          </h2>
          <UnitToggle unit={unit} onUnit={onUnit} />
        </div>
        {data.table.notice ? <p className="mt-3 text-sm text-muted">{data.table.notice}</p> : null}
        <table className="mt-4 w-full text-left text-sm">
          <caption className="sr-only">
            {previewTitle(data.table)}, in {unit === "in" ? "inches" : "centimetres"}
          </caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 pr-3 font-medium">
                {plain("Point of measure")}
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Value
              </th>
              <th scope="col" className="py-1 font-medium">
                {plain("Provenance")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pointId} className="border-t border-hairline">
                <th scope="row" className="py-2 pr-3 font-normal text-ink">
                  {row.label}
                </th>
                <td className="py-2 pr-3 font-mono text-ink" data-testid={`preview-${row.pointId}`}>
                  {row.value}
                </td>
                <td className="py-2 text-muted">{row.source ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function UnitToggle({ unit, onUnit }: Readonly<{ unit: LengthUnit; onUnit: (unit: LengthUnit) => void }>) {
  return (
    <fieldset className="flex items-center gap-3">
      <legend className="sr-only">Show lengths in</legend>
      {UNITS.map((choice) => (
        <label key={choice.id} className="flex items-center gap-1 text-sm text-ink">
          <input type="radio" name="length-unit" value={choice.id} checked={unit === choice.id} onChange={() => onUnit(choice.id)} />
          {choice.label}
        </label>
      ))}
    </fieldset>
  );
}
