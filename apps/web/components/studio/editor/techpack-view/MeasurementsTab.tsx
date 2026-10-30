"use client";

import { useId, useState } from "react";
import {
  MEASUREMENT_MODES,
  MODE_LABELS,
  type AutoMapPlan,
  type ExtraPom,
  type MeasurementMode,
  type MeasurementsView,
  type PomRow,
} from "@/lib/techpack/view";
import { WhyButton } from "../WhyButton";

/**
 * The **Measurements** tab of spec F-S6: the toolbar with **+ Add measurement** and **Auto-map** and
 * the **Measurement | Grading** toggle, then the table — letter, measurement, grade type, grade,
 * both tolerances, one column per size with the sample size highlighted, and the rule.
 *
 * Every grade comes from the base article and is locked, so each row carries a lock and a "Why?"
 * on its rule (spec F-S6 rules). A tolerance the base does not give stays empty: the row says so
 * and the Review tab asks the factory for it (plan v5 decision 18).
 */

type Props = Readonly<{
  view: MeasurementsView;
  autoMap: AutoMapPlan;
  /** The size the canvas is showing, which is underlined as well as the sample size. */
  shownSize: string;
  busy: boolean;
  onMode: (mode: MeasurementMode) => void;
  onAdd: (extra: ExtraPom) => void;
}>;

const LOCK_NOTE = "The base article fixes this grade.";

export function MeasurementsTab({ view, autoMap, shownSize, busy, onMode, onAdd }: Props) {
  const modeId = useId();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-3" data-testid="techpack-measurements">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-labelledby={`${modeId}-legend`} className="flex items-center gap-2 rounded-2xl bg-tile-2/70 p-1">
          <span id={`${modeId}-legend`} className="sr-only">
            What the table shows
          </span>
          {MEASUREMENT_MODES.map((mode) => (
            <label key={mode} htmlFor={`${modeId}-${mode}`} className="flex min-h-10 items-center gap-2 px-2 text-[13px] text-ink">
              <input
                id={`${modeId}-${mode}`}
                type="radio"
                name={`${modeId}-mode`}
                value={mode}
                checked={view.mode === mode}
                disabled={busy}
                onChange={() => onMode(mode)}
                className="size-4 accent-cobalt"
              />
              {MODE_LABELS[mode]}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          disabled={busy}
          className="chip-btn min-h-10 rounded-full border border-white/20 px-4 text-sm font-medium text-ink"
          data-testid="techpack-add-measurement"
        >
          + Add measurement
        </button>
        <AutoMap plan={autoMap} />
      </div>
      {adding ? <AddMeasurement busy={busy} onAdd={(extra) => { onAdd(extra); setAdding(false); }} /> : null}
      {view.note ? <p className="text-[13px] leading-relaxed text-warn">{view.note}</p> : null}
      {view.rows.length === 0 ? null : <PomTable view={view} shownSize={shownSize} />}
    </div>
  );
}

/** Auto-map says what pressing it would place; with every point already on the table it places nothing. */
function AutoMap({ plan }: Readonly<{ plan: AutoMapPlan }>) {
  return (
    <span className="flex items-center gap-1" data-testid="techpack-auto-map">
      <button
        type="button"
        disabled={plan.missing.length === 0}
        aria-describedby="techpack-auto-map-note"
        className="chip-btn min-h-10 rounded-full border border-white/20 px-4 text-sm font-medium text-ink"
      >
        Auto-map
      </button>
      <span id="techpack-auto-map-note" className="text-[11px] text-chalk-muted">
        {plan.message}
      </span>
    </span>
  );
}

function PomTable({ view, shownSize }: Readonly<{ view: MeasurementsView; shownSize: string }>) {
  const grading = view.mode === "grading";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" data-testid="techpack-pom-table">
        <caption className="sr-only">Points of measure, in {view.unit}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
              Letter
            </th>
            <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
              Measurement
            </th>
            <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
              Grade type
            </th>
            <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
              Grade
            </th>
            <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
              Tol &minus;
            </th>
            <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
              Tol +
            </th>
            {view.columns.map((column) => (
              <th
                key={column.size}
                scope="col"
                aria-current={column.isSample ? "true" : undefined}
                className={`px-2 py-1 text-[11px] font-medium ${column.isSample ? "bg-cobalt/20 text-ink" : "text-chalk-muted"}`}
                data-testid={`techpack-size-${column.size}`}
              >
                {column.size}
                {column.isSample ? <span className="sr-only"> (the sample size)</span> : null}
              </th>
            ))}
            <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
              Rule
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <Row key={row.letter} row={row} grading={grading} shownSize={shownSize} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RowProps = Readonly<{ row: PomRow; grading: boolean; shownSize: string }>;

function Row({ row, grading, shownSize }: RowProps) {
  return (
    <tr className="border-t border-white/10" data-testid={`techpack-pom-${row.letter}`}>
      <th scope="row" className="px-2 py-1 text-[13px] font-medium text-ink">
        {row.letter}
      </th>
      <td className="px-2 py-1 text-[13px] text-ink">{row.description}</td>
      <td className="px-2 py-1 text-[13px] text-ink">{row.gradeTypeLabel}</td>
      <td className="px-2 py-1 text-[13px] text-ink">
        <Value text={row.grade} />
        {row.locked ? <Lock /> : null}
      </td>
      <td className="px-2 py-1 text-[13px] text-ink">
        <Value text={row.tolMinus} />
      </td>
      <td className="px-2 py-1 text-[13px] text-ink">
        <Value text={row.tolPlus} />
      </td>
      {(grading ? row.steps : row.values).map((value) => (
        <td
          key={value.size}
          className={`px-2 py-1 text-[13px] ${value.isSample ? "bg-cobalt/20 text-ink" : "text-ink"} ${value.size === shownSize && !value.isSample ? "underline" : ""}`}
        >
          <Value text={value.text} />
        </td>
      ))}
      <td className="px-2 py-1">
        <span className="flex items-center gap-1">
          <span className="font-mono text-[11px] text-chalk-muted">{row.ruleId}</span>
          <WhyButton ruleId={row.ruleId} context={`techpack measurement ${row.letter}`} />
        </span>
      </td>
    </tr>
  );
}

/** A value, or the mark that says nobody has it. A missing value is never drawn as a zero. */
const Value = ({ text }: Readonly<{ text: string | null }>) =>
  text === null ? (
    <span className="text-warn">
      <span aria-hidden="true">&mdash;</span>
      <span className="sr-only">Nobody has given this yet.</span>
    </span>
  ) : (
    <span>{text}</span>
  );

const Lock = () => (
  <span className="ml-1 text-[11px] text-chalk-muted" title={LOCK_NOTE}>
    <span aria-hidden="true">&#128274;</span>
    <span className="sr-only">{LOCK_NOTE}</span>
  </span>
);

/** The "+ Add measurement" form: a founder's own QC point, with no grade and no tolerance. */
function AddMeasurement({ busy, onAdd }: Readonly<{ busy: boolean; onAdd: (extra: ExtraPom) => void }>) {
  const id = useId();
  const [description, setDescription] = useState("");
  const [mm, setMm] = useState("");
  const given = description.trim() !== "";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 p-3" data-testid="techpack-add-form">
      <p className="text-[11px] leading-relaxed text-chalk-muted">
        A measurement of your own is measured on the sample at the sample size. The base article does not grade it, so it takes no grade and no tolerance.
      </p>
      <label htmlFor={`${id}-description`} className="text-[11px] text-chalk-muted">
        What is measured
      </label>
      <input
        id={`${id}-description`}
        type="text"
        value={description}
        maxLength={120}
        disabled={busy}
        onChange={(event) => setDescription(event.target.value)}
        className="min-h-10 rounded-xl border border-white/20 bg-tile-2 px-2 text-[13px] text-ink"
      />
      <label htmlFor={`${id}-mm`} className="text-[11px] text-chalk-muted">
        What it measured on the sample, in millimetres (leave it empty until you measure one)
      </label>
      <input
        id={`${id}-mm`}
        type="number"
        inputMode="decimal"
        value={mm}
        disabled={busy}
        onChange={(event) => setMm(event.target.value)}
        className="min-h-10 rounded-xl border border-white/20 bg-tile-2 px-2 text-[13px] text-ink"
      />
      <button
        type="button"
        disabled={busy || !given}
        onClick={() => onAdd({ letter: "", description: description.trim(), sampleMm: mm.trim() === "" ? null : globalThis.Number(mm), ruleId: null })}
        className="chip-btn min-h-10 self-start rounded-full border border-white/20 px-4 text-sm font-medium text-ink"
      >
        Add it to the table
      </button>
    </div>
  );
}
