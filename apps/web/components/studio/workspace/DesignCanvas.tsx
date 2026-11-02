"use client";

import type { ReactNode } from "react";
import { previewRows } from "@/lib/guided/preview";
import type { MeasurementTable } from "@/lib/projects/measurement-table";
import type { FlatPreviewData } from "@/lib/projects/flat-preview";
import { FlatPreview } from "../FlatPreview";

/** How many measurements sit under the drawing as a reminder. The whole table is in the Sizes tool. */
const CHIPS = 3;

type CanvasProps = Readonly<{
  flat: FlatPreviewData | null;
  table: MeasurementTable;
  show3d: boolean;
  /** Messages about the whole design: a conflict, a failed save, what a change removed. */
  notices: ReactNode;
}>;

/** The centre of the workspace: the drawing of both sides on a dot grid, with the design's messages above it. */
export function DesignCanvas({ flat, table, show3d, notices }: CanvasProps) {
  return (
    <section
      aria-label="Drawing"
      className="glass dot-grid relative order-first flex min-h-0 flex-col overflow-hidden rounded-[2rem] lg:order-none"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[26rem] -translate-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(130,150,255,0.22),transparent)]"
      />
      <div className="flex flex-col gap-2 px-4 pt-4 empty:hidden">{notices}</div>
      {/*
       * The drawing scrolls inside this box on a wide screen, where the shell's height is fixed,
       * and the only thing in it is a picture: nothing here can take focus, so without `tabIndex`
       * a person on a keyboard cannot scroll it at all. That is WCAG 2.1.1, and axe's
       * `scrollable-region-focusable`, which the editor's first desktop scan of the 2D view found
       * (PR #150, CI run 41492407412). The box is named by the section around it.
       */}
      <div tabIndex={0} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
        <FlatPreview flat={flat} show3d={show3d} />
      </div>
      <MeasurementChips table={table} />
    </section>
  );
}

function MeasurementChips({ table }: Readonly<{ table: MeasurementTable }>) {
  const rows = previewRows(table, "cm").slice(0, CHIPS);
  if (rows.length === 0) return null;
  return (
    <ul aria-label="Some measurements" className="relative flex flex-wrap gap-2 px-4 pb-4">
      {rows.map((row) => (
        <li key={row.pointId} className="rounded-xl bg-tile-2/90 px-3 py-2 text-xs text-ink-2">
          {row.label} <b className="font-mono font-medium text-ink">{row.value}</b>
        </li>
      ))}
      {table.size ? (
        <li className="rounded-xl bg-tile-2/90 px-3 py-2 text-xs text-ink-2">
          Size <b className="font-mono font-medium text-ink">{table.size}</b>
        </li>
      ) : null}
    </ul>
  );
}
