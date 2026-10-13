"use client";

import { useEffect, useId, useReducer } from "react";
import { fieldReduce, initialField, intentFromText, isDirty, sameCm, type FieldState } from "@/lib/projects/field-text";
import type { TableRow } from "@/lib/projects/measurement-table";
import { measurementKey } from "./keys";
import type { MeasurementHandlers } from "./MeasurementTables";
import { ProvenanceBadge } from "./ProvenanceBadge";

type MeasurementRowProps = Readonly<{ row: TableRow; error: string | null }> & Omit<MeasurementHandlers, "errorFor">;

/** The text of the field is kept by a reducer (lib/projects/field-text). This holds markup and wiring. */
export function MeasurementRow({ row, error, onEdit, onReset, onTyping, onDirty }: MeasurementRowProps) {
  const id = useId();
  const [field, change] = useReducer(fieldReduce, row.valueCm, initialField);
  const { pointId } = row;

  useEffect(() => change({ type: "server", valueCm: row.valueCm }), [row.valueCm]);
  const dirty = isDirty(field.text, field.server);
  useEffect(() => onDirty(measurementKey(pointId), dirty), [pointId, dirty, onDirty]);
  useEffect(() => () => onDirty(measurementKey(pointId), false), [pointId, onDirty]);

  const submit = (asked: boolean) => {
    const intent = intentFromText(field.text, row);
    const repeated = field.sent !== null && sameCm(field.sent, field.text);
    if (intent.kind === "none" || (repeated && !asked)) return;
    if (intent.kind !== "invalid") change({ type: "sent" });
    onEdit(pointId, intent, asked);
  };

  return (
    <tr>
      <th scope="row" className="max-w-md px-4 py-3 align-top font-medium text-ink">
        {row.label}
        <span id={`${id}-how`} className="mt-1 block text-sm font-normal text-muted">
          {row.howToMeasure}
        </span>
      </th>
      <td className="px-4 py-3 align-top">
        <ValueCell
          id={id}
          row={row}
          field={field}
          error={error}
          onType={(text) => {
            change({ type: "type", text });
            onTyping(pointId);
          }}
          onSubmit={submit}
        />
      </td>
      <td className="px-4 py-3 align-top font-mono text-sm text-ink-2">{row.tolerance}</td>
      <td className="px-4 py-3 align-top">
        <SourceCell row={row} onReset={() => onReset(pointId)} />
      </td>
    </tr>
  );
}

type ValueCellProps = Readonly<{
  id: string;
  row: TableRow;
  field: FieldState;
  error: string | null;
  onType: (text: string) => void;
  onSubmit: (asked: boolean) => void;
}>;

function ValueCell({ id, row, field, error, onType, onSubmit }: ValueCellProps) {
  const describedBy = [`${id}-how`, row.message ? `${id}-note` : null, error ? `${id}-error` : null, field.changedElsewhere ? `${id}-moved` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(true);
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor={`${id}-value`} className="sr-only">
          {row.label} in centimetres
        </label>
        <input
          id={`${id}-value`}
          data-field={measurementKey(row.pointId)}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={field.text}
          onChange={(event) => onType(event.target.value)}
          onBlur={() => onSubmit(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-10 w-24 rounded-lg border border-hairline bg-surface px-3 font-mono text-[15px] text-ink aria-[invalid]:border-warn"
        />
        <span aria-hidden="true" className="text-sm text-muted">cm</span>
      </form>
      {row.message ? <p id={`${id}-note`} className="mt-2 max-w-xs text-sm text-muted">{row.message}</p> : null}
      {field.changedElsewhere ? (
        <p id={`${id}-moved`} role="status" className="mt-2 max-w-xs text-sm text-warn">
          This design changed while you were typing. Your text is kept. Press Enter to use it.
        </p>
      ) : null}
      {error ? <p id={`${id}-error`} role="alert" className="mt-2 max-w-xs text-sm text-warn">{error}</p> : null}
    </>
  );
}

function SourceCell({ row, onReset }: Readonly<{ row: TableRow; onReset: () => void }>) {
  return (
    <>
      {row.provenanceLabel && row.tone ? (
        <ProvenanceBadge label={row.provenanceLabel} tone={row.tone} />
      ) : (
        <span className="text-sm text-muted">No value yet</span>
      )}
      {row.canResetToChart ? (
        <button
          type="button"
          onClick={onReset}
          aria-label={`Use the chart value for ${row.label}`}
          className="mt-2 block rounded-md text-sm font-medium text-cobalt-soft underline-offset-4 hover:underline"
        >
          Use the chart value
        </button>
      ) : null}
    </>
  );
}
