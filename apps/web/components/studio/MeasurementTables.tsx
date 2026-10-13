"use client";

import type { EditIntent } from "@/lib/projects/field-text";
import type { MeasurementTable, TableGroup, TableRow } from "@/lib/projects/measurement-table";
import { measurementKey } from "./keys";
import { MeasurementRow } from "./MeasurementRow";

export type MeasurementHandlers = Readonly<{
  /** Called with what the person asked for. `asked` is true when they pressed Enter. */
  onEdit: (pointId: string, intent: EditIntent, asked: boolean) => void;
  onReset: (pointId: string) => void;
  onTyping: (pointId: string) => void;
  /** Must keep the same identity between renders. Called with the field's name and whether it holds unsaved text. */
  onDirty: (key: string, dirty: boolean) => void;
  errorFor: (key: string) => string | null;
}>;

type MeasurementTablesProps = Readonly<{ table: MeasurementTable }> & MeasurementHandlers;

const HEADINGS = ["Measurement", "Value", "Tolerance", "Where the value came from"] as const;

/**
 * One real table for each section, with header cells, so a screen reader can walk it. On a
 * phone each row becomes a card: the name, the field, and the rest below, with nothing off
 * the side of the screen.
 */
export function MeasurementTables({ table, ...handlers }: MeasurementTablesProps) {
  return (
    <div className="flex flex-col gap-6">
      {table.notice ? <p className="text-sm leading-relaxed text-muted">{table.notice}</p> : null}
      {table.groups.map((group) => (
        <GroupTable key={group.group} group={group} {...handlers} />
      ))}
    </div>
  );
}

type GroupTableProps = Readonly<{ group: TableGroup }> & MeasurementHandlers;

function GroupTable({ group, errorFor, ...handlers }: GroupTableProps) {
  return (
    <div className="rounded-xl border border-hairline sm:overflow-x-auto">
      <table className="block w-full text-left text-[15px] sm:table sm:min-w-[44rem]">
        <caption className="block border-b border-hairline px-4 py-3 text-left text-sm font-semibold text-ink sm:table-caption">
          {group.label}
        </caption>
        <thead className="sr-only sm:not-sr-only sm:table-header-group">
          <tr className="text-sm text-muted">
            {HEADINGS.map((heading) => (
              <th key={heading} scope="col" className="px-4 py-2 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y divide-hairline sm:table-row-group">
          {group.rows.map((row: TableRow) => (
            <MeasurementRow key={row.pointId} row={row} error={errorFor(measurementKey(row.pointId))} {...handlers} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
