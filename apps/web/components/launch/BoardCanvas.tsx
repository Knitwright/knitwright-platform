"use client";

import type { CSSProperties } from "react";
import { FlowCanvas } from "@/components/flows/FlowCanvas";
import type { EmptyState, Graph, LaunchCommands } from "@/lib/launch";

type Props = Readonly<{
  graph: Graph;
  selectedId: string | null;
  zoom: number;
  busy: boolean;
  empty: EmptyState | null;
  /** The contract's own commands, which is all the canvas is allowed to ask for. */
  commands: LaunchCommands;
}>;

/** The dotted canvas, drawn here rather than in the shared stylesheet, which this workstream does not own. */
const DOTS: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

/**
 * The canvas of boards (spec F-L4).
 *
 * L1 drew the boards in a wrapping row and left the places, the curved connectors, the dragging and
 * the keyboard moves to the workstream that owns the flow canvas. **L6 built that canvas**
 * (`components/flows/FlowCanvas.tsx`, decision 0096) against the same `LaunchCommands` contract, so
 * this file now owns two things only: the empty state that asks for a Design board, and the notice
 * on a canvas that has boards but no design behind them. Everything a person does to a board is
 * L6's canvas, which is operable from the keyboard as well as by dragging.
 *
 * The empty state keeps its own dotted surface, so an empty canvas still looks like a canvas rather
 * than like a page with nothing on it.
 */
export function BoardCanvas({ graph, selectedId, zoom, busy, empty, commands }: Props) {
  const addDesign = () => commands.addBoard("design", { x: 0, y: 0 });
  return (
    <div data-testid="launch-canvas" className="flex min-h-0 flex-1 flex-col gap-3">
      {graph.boards.length === 0 ? (
        // A solid surface rather than glass: the canvas is the one place a person reads small text
        // against whatever the page happens to put behind it, and a known background is a known
        // contrast ratio.
        <section
          aria-label="Canvas"
          style={DOTS}
          className="flex min-h-0 flex-1 flex-col overflow-auto rounded-3xl border border-hairline bg-surface-solid p-4"
        >
          <EmptyCanvas empty={empty} busy={busy} onAdd={addDesign} />
        </section>
      ) : (
        <>
          {/* Boards but no Design board: the boards are still shown, with the one action that
              gives them a garment to start from. Hiding them would hide the person's own work. */}
          {empty ? <MissingDesign empty={empty} busy={busy} onAdd={addDesign} /> : null}
          <FlowCanvas graph={graph} selectedId={selectedId} zoom={zoom} busy={busy} commands={commands} />
        </>
      )}
    </div>
  );
}

type EmptyProps = Readonly<{ empty: EmptyState | null; busy: boolean; onAdd: () => void }>;

function EmptyCanvas({ empty, busy, onAdd }: EmptyProps) {
  if (!empty) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center" data-testid="launch-empty">
      <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{empty.title}</h2>
      <p className="max-w-md text-[15px] leading-relaxed text-muted">{empty.body}</p>
      <AddDesign label={empty.action} busy={busy} onAdd={onAdd} />
    </div>
  );
}

function MissingDesign({ empty, busy, onAdd }: Readonly<{ empty: EmptyState; busy: boolean; onAdd: () => void }>) {
  return (
    <div role="status" data-testid="launch-missing-design" className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn-wash px-4 py-3">
      <p className="min-w-56 flex-1 text-[13px] leading-relaxed text-warn">{empty.body}</p>
      <AddDesign label={empty.action} busy={busy} onAdd={onAdd} />
    </div>
  );
}

function AddDesign({ label, busy, onAdd }: Readonly<{ label: string; busy: boolean; onAdd: () => void }>) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onAdd}
      className="chip-btn inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 text-sm font-medium text-ink"
      data-testid="launch-empty-action"
    >
      {label}
    </button>
  );
}
