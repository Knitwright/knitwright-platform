"use client";

import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { WEARERS, listTypes } from "@/lib/garment";
import type { Grid } from "@/lib/charts/grid";
import {
  columnChoices,
  pointChoices,
  rowPreview,
  setRowPoint,
  sizeLabels,
  toggleSizeColumn,
  type ChartScreen,
} from "@/lib/charts/screen";
import { CHART_UNITS, UNIT_WORDS } from "@/lib/charts/units";
import { FIT_CHOICES } from "@/lib/sizing/schemas";

type Props = Readonly<{ grid: Grid; fileName: string; screen: ChartScreen; onChange: (next: ChartScreen) => void }>;

const AUTO = "auto";
const LEAVE_OUT = "leave-out";
const NO_COLUMN = "";

const asOptions = (choices: readonly { index: number; label: string }[]) =>
  choices.map((choice) => ({ id: String(choice.index), label: choice.label }));

/** The column mapping screen. Markup and wiring only: each change is a function in lib/charts/screen. */
export function ChartMappingForm({ grid, fileName, screen, onChange }: Props) {
  const columns = columnChoices(grid, screen.headerLine);
  const set = (patch: Partial<ChartScreen>) => onChange({ ...screen, ...patch });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Read from {fileName}. Choose what each column holds.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          name="garmentType"
          label="Garment"
          value={screen.garmentType}
          options={listTypes().map((type) => ({ id: type.id, label: type.label }))}
          onChange={(event) => set({ garmentType: event.target.value, rowPoints: [] })}
        />
        <SelectField
          name="wearer"
          label="Wearer"
          value={screen.wearer}
          options={WEARERS.map((wearer) => ({ id: wearer, label: wearer }))}
          onChange={(event) => set({ wearer: WEARERS.find((wearer) => wearer === event.target.value) ?? screen.wearer })}
        />
        <SelectField
          name="fit"
          label="Fit"
          value={screen.fit ?? ""}
          placeholder="Every fit"
          options={FIT_CHOICES.map((fit) => ({ id: fit, label: fit }))}
          onChange={(event) => set({ fit: FIT_CHOICES.find((fit) => fit === event.target.value) ?? null })}
        />
        <SelectField
          name="headerLine"
          label="Heading row"
          value={String(screen.headerLine)}
          options={grid.map((row) => ({ id: String(row.line), label: `Line ${row.line}: ${row.cells.join(" | ").slice(0, 60)}` }))}
          onChange={(event) => set({ headerLine: Number(event.target.value) })}
        />
        <SelectField
          name="pointColumn"
          label="Point of measure column"
          value={String(screen.pointColumn)}
          options={asOptions(columns)}
          onChange={(event) => set({ pointColumn: Number(event.target.value) })}
        />
        <SelectField
          name="toleranceColumn"
          label="Tolerance column"
          value={screen.toleranceColumn === null ? "" : String(screen.toleranceColumn)}
          placeholder="Choose a column"
          options={asOptions(columns)}
          onChange={(event) => set({ toleranceColumn: event.target.value === "" ? null : Number(event.target.value) })}
        />
        <SelectField
          name="units"
          label="Units of the values"
          value={screen.units}
          options={CHART_UNITS.map((unit) => ({ id: unit, label: UNIT_WORDS[unit] }))}
          onChange={(event) => set({ units: CHART_UNITS.find((unit) => unit === event.target.value) ?? screen.units })}
        />
        <SelectField
          name="unitsColumn"
          label="Units column, if the file has one"
          hint="A row whose cell says cm or in is read in that unit. An empty cell uses the units above."
          value={screen.unitsColumn === null ? NO_COLUMN : String(screen.unitsColumn)}
          placeholder="No units column"
          options={asOptions(columns)}
          onChange={(event) => set({ unitsColumn: event.target.value === NO_COLUMN ? null : Number(event.target.value) })}
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Size columns, smallest size first</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {columns.map((column) => (
            <label key={column.index} className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={screen.sizeColumns.includes(column.index)}
                onChange={() => onChange(toggleSizeColumn(grid, screen, column.index))}
              />
              {column.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          name="baseSize"
          label="Base size"
          value={screen.baseSize}
          placeholder="Choose the base size"
          options={sizeLabels(grid, screen).map((size) => ({ id: size, label: size }))}
          onChange={(event) => set({ baseSize: event.target.value })}
        />
        <Field
          name="person"
          label="Who produced these numbers"
          hint="A real person's name. It is shown as the source of the chart, with today's date."
          value={screen.person}
          maxLength={80}
          onChange={(event) => set({ person: event.target.value })}
        />
      </div>
      <RowTable grid={grid} screen={screen} onChange={onChange} />
    </div>
  );
}

function RowTable({ grid, screen, onChange }: Omit<Props, "fileName">) {
  const points = pointChoices(screen.garmentType);
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Which point of measure each row gives</caption>
        <thead>
          <tr className="border-b border-hairline text-muted">
            <th scope="col" className="px-3 py-2 font-medium">Line</th>
            <th scope="col" className="px-3 py-2 font-medium">Name in the file</th>
            <th scope="col" className="px-3 py-2 font-medium">Point of measure</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rowPreview(grid, screen).map((row) => (
            <tr key={row.line}>
              <td className="px-3 py-2 font-mono text-xs">{row.line}</td>
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2">
                <select
                  aria-label={`Point of measure for line ${row.line}`}
                  className="h-10 rounded-md border border-hairline bg-surface px-2"
                  value={row.chosen ? (row.pointId ?? LEAVE_OUT) : AUTO}
                  onChange={(event) =>
                    onChange(setRowPoint(screen, row.line, event.target.value === LEAVE_OUT ? null : event.target.value))
                  }
                >
                  <option value={AUTO}>
                    {row.pointId !== null && !row.chosen ? `Matched: ${points.find((point) => point.id === row.pointId)?.label ?? row.pointId}` : "Not recognised"}
                  </option>
                  <option value={LEAVE_OUT}>Leave this row out</option>
                  {points.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
