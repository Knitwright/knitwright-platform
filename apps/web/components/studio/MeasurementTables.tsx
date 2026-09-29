"use client";

import { useId, useState } from "react";
import type { MeasurementTable, TableRow } from "@/lib/projects/measurement-table";
import { ProvenanceBadge } from "./ProvenanceBadge";

type MeasurementTablesProps = Readonly<{
  table: MeasurementTable;
  /** Called with the text a person typed, for the row they typed it in. */
  onEdit: (pointId: string, text: string) => void;
  onReset: (pointId: string) => void;
  errorFor: (key: string) => string | null;
}>;

export const measurementKey = (pointId: string): string => `measurement:${pointId}`;

/** One real table for each section, with header cells, so a screen reader can walk it. */
export function MeasurementTables({ table, onEdit, onReset, errorFor }: MeasurementTablesProps) {
  return (
    <div className="flex flex-col gap-6">
      {table.notice ? <p className="text-sm leading-relaxed text-muted">{table.notice}</p> : null}
      {table.groups.map((group) => (
        <div key={group.group} className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full min-w-[44rem] text-left text-[15px]">
            <caption className="border-b border-hairline px-4 py-3 text-left text-sm font-semibold text-ink">
              {group.label}
            </caption>
            <thead>
              <tr className="text-sm text-muted">
                <th scope="col" className="px-4 py-2 font-medium">Measurement</th>
                <th scope="col" className="px-4 py-2 font-medium">Value</th>
                <th scope="col" className="px-4 py-2 font-medium">Tolerance</th>
                <th scope="col" className="px-4 py-2 font-medium">Where the value came from</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {group.rows.map((row) => (
                <MeasurementRow
                  key={row.pointId}
                  row={row}
                  onEdit={onEdit}
                  onReset={onReset}
                  error={errorFor(measurementKey(row.pointId))}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

type MeasurementRowProps = Readonly<{
  row: TableRow;
  onEdit: (pointId: string, text: string) => void;
  onReset: (pointId: string) => void;
  error: string | null;
}>;

function MeasurementRow({ row, onEdit, onReset, error }: MeasurementRowProps) {
  const id = useId();
  const [text, setText] = useState(row.valueCm);
  const [seen, setSeen] = useState(row.valueCm);
  const [sent, setSent] = useState<string | null>(null);

  // A new value from the server replaces whatever is in the field.
  if (seen !== row.valueCm) {
    setSeen(row.valueCm);
    setText(row.valueCm);
    setSent(null);
  }

  const send = () => {
    setSent(text);
    onEdit(row.pointId, text);
  };
  const describedBy = [`${id}-how`, row.message ? `${id}-note` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <tr>
      <th scope="row" className="max-w-md px-4 py-3 align-top font-medium text-ink">
        {row.label}
        <span id={`${id}-how`} className="mt-1 block text-sm font-normal text-muted">
          {row.howToMeasure}
        </span>
      </th>
      <td className="px-4 py-3 align-top">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (text !== row.valueCm) send();
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
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => {
              if (text !== row.valueCm && text !== sent) send();
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="h-10 w-24 rounded-lg border border-hairline bg-surface px-3 font-mono text-[15px] text-ink aria-[invalid]:border-warn"
          />
          <span aria-hidden="true" className="text-sm text-muted">cm</span>
        </form>
        {row.message ? (
          <p id={`${id}-note`} className="mt-2 max-w-xs text-sm text-muted">
            {row.message}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="mt-2 max-w-xs text-sm text-warn">
            {error}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top font-mono text-sm text-ink-2">{row.tolerance}</td>
      <td className="px-4 py-3 align-top">
        {row.provenanceLabel && row.tone ? (
          <ProvenanceBadge label={row.provenanceLabel} tone={row.tone} />
        ) : (
          <span className="text-sm text-muted">No value yet</span>
        )}
        {row.canResetToChart ? (
          <button
            type="button"
            onClick={() => onReset(row.pointId)}
            aria-label={`Use the chart value for ${row.label}`}
            className="mt-2 block rounded-md text-sm font-medium text-cobalt underline-offset-4 hover:underline"
          >
            Use the chart value
          </button>
        ) : null}
      </td>
    </tr>
  );
}
