"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { WhyButton } from "@/components/studio/editor/WhyButton";
import { Button } from "@/components/ui/Button";
import { GAP_RULE } from "@/lib/kpp/model";
import { Icon } from "@/components/ui/Icon";
import { TextInput } from "@/components/ui/Inputs";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { Segmented } from "@/components/ui/Tabs";
import type { EditorTab } from "@/lib/techpack/editor/tabs";
import { toleranceText } from "@/lib/techpack/editor/tolerance";
import { MEASUREMENT_MODES, MODE_LABELS, type ExtraPom, type MeasurementMode, type MeasurementsView, type PomRow } from "@/lib/techpack/view/measurements";
import { UNIT_LABELS } from "@/lib/techpack/view/units";
import { PartView } from "./Parts";
import type { StageSelection } from "./StageMarks";

/**
 * The Measurements tab (spec screen 30, s10 and s15): the points of measure with their red letters,
 * one "Tol ±" column, and one column per size XS–3XL with the chosen size highlighted (the sample
 * size, M, until another is chosen). Every value is the base article's (`buildMeasurements`); the
 * Measurement | Grading toggle and "+ Add measurement" are kept from the v2.2 view. QC follows, 🔒.
 */

type Props = Readonly<{
  tab: EditorTab;
  view: MeasurementsView;
  /** The size the stage shows: its column is the highlighted one. */
  size: string;
  selection: StageSelection;
  onSelect: (selection: StageSelection) => void;
  onMode: (mode: MeasurementMode) => void;
  onAdd: (extra: ExtraPom) => void;
}>;

export function MeasurementsBody({ tab, view, size, selection, onSelect, onMode, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [, ...folded] = tab.parts;
  const grading = view.mode === "grading";
  return (
    <div className="flex flex-col gap-4" data-testid="tp-measurements">
      <div className="flex flex-wrap items-center gap-2 px-3">
        <Segmented
          label="What the table shows"
          value={view.mode}
          onChange={(mode) => onMode(mode as MeasurementMode)}
          options={MEASUREMENT_MODES.map((mode) => ({
            id: mode,
            label: MODE_LABELS[mode],
          }))}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={<Icon icon={Plus} size={16} />}
          onClick={() => setAdding(!adding)}
          aria-expanded={adding}
          data-testid="tp-add-measurement"
        >
          Add measurement
        </Button>
      </div>
      {adding ? (
        <AddMeasurement
          unit={UNIT_LABELS[view.unit]}
          onAdd={(extra) => {
            onAdd(extra);
            setAdding(false);
          }}
        />
      ) : null}
      {view.note ? <p className="px-3 text-small text-warn">{view.note}</p> : null}
      {view.rows.length > 0 ? (
        <Table caption={`Points of measure, in ${UNIT_LABELS[view.unit]}${grading ? ", step from the size before" : ""}`}>
          <thead>
            <tr>
              <Th className="w-10">
                <span className="sr-only">Letter</span>
              </Th>
              <Th>Point of measure</Th>
              <Th numeric>Tol ±</Th>
              {view.columns.map((column) => (
                <Th
                  key={column.size}
                  numeric
                  highlight={column.size === size}
                  aria-current={column.size === size ? "true" : undefined}
                  data-testid={`tp-size-${column.size}`}
                >
                  {column.size}
                  {column.isSample ? <span className="sr-only"> (the sample size)</span> : null}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <PomLine
                key={row.letter}
                row={row}
                grading={grading}
                size={size}
                selected={selection?.kind === "point" && selection.letter === row.letter}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </Table>
      ) : null}
      {folded.map((part) => (
        <PartView key={part.from} part={part} />
      ))}
    </div>
  );
}

type LineProps = Readonly<{
  row: PomRow;
  grading: boolean;
  size: string;
  selected: boolean;
  onSelect: (selection: StageSelection) => void;
}>;

function PomLine({ row, grading, size, selected, onSelect }: LineProps) {
  return (
    <Tr className={selected ? "bg-bad-soft" : undefined}>
      <Td>
        <button
          type="button"
          onClick={() => onSelect({ kind: "point", letter: row.letter })}
          aria-label={`Show point ${row.letter} on the garment`}
          aria-pressed={selected}
          className="grid size-6 place-items-center rounded-full bg-mark-measure text-caption font-bold text-on-dark"
          data-testid={`tp-pom-${row.letter}`}
        >
          {row.letter}
        </button>
      </Td>
      <Td className="font-medium">
        {row.description}
        {row.isExtra ? <span className="ml-2 text-caption text-muted">Yours, measured on the sample</span> : null}
        {selected && row.ruleId !== GAP_RULE ? <WhyButton ruleId={row.ruleId} context={`tech pack measurement ${row.letter}`} /> : null}
      </Td>
      <Td numeric>{toleranceText(row) ?? <Missing />}</Td>
      {(grading ? row.steps : row.values).map((value) => (
        <Td key={value.size} numeric highlight={value.size === size}>
          {value.text ?? (row.isExtra || grading ? <span className="text-muted">—</span> : <Missing />)}
        </Td>
      ))}
    </Tr>
  );
}

/** A value nobody has given: never a nought. */
const Missing = () => (
  <span className="text-warn">
    <span aria-hidden="true">—</span>
    <span className="sr-only">Nobody has given this yet.</span>
  </span>
);

function AddMeasurement({ unit, onAdd }: Readonly<{ unit: string; onAdd: (extra: ExtraPom) => void }>) {
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const millimetres = value.trim() === "" ? null : Number(value);
  const valid = description.trim() !== "" && (millimetres === null || (Number.isFinite(millimetres) && millimetres > 0));
  return (
    <form
      className="flex flex-wrap items-end gap-2 px-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid)
          onAdd({
            letter: "",
            description: description.trim(),
            sampleMm: millimetres,
            ruleId: null,
          });
      }}
      data-testid="tp-add-measurement-form"
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-caption text-text-2">
        What is measured
        <TextInput value={description} onChange={(event) => setDescription(event.target.value)} maxLength={60} />
      </label>
      <label className="flex w-40 flex-col gap-1 text-caption text-text-2">
        On the sample, in mm (optional)
        <TextInput inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <Button type="submit" size="sm" disabled={!valid}>
        Add
      </Button>
      <span className="sr-only">Shown in {unit}.</span>
    </form>
  );
}
