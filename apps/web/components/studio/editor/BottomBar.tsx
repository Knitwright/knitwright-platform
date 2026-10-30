"use client";

import { useId } from "react";
import type { CanvasView, SimulateChip } from "@/lib/editor";
import { CANVAS_VIEWS, VIEWS, showing } from "@/lib/editor";
import type { ColourwayChoice } from "@/lib/projects/colour-controls";

const SELECT = "min-h-10 rounded-xl border border-white/15 bg-surface px-2 text-[13px] text-ink";
const SMALL = "chip-btn inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/20 px-3 text-[13px] font-medium text-ink";

type Props = Readonly<{
  colourways: readonly ColourwayChoice[];
  colourwayId: string;
  onColourway: (id: string) => void;
  onNewColourway: () => void;
  sizes: readonly string[];
  size: string;
  onSize: (size: string) => void;
  view: CanvasView;
  beside: CanvasView | null;
  onView: (view: CanvasView, alongside: boolean) => void;
  simulate: SimulateChip;
  onSimulate: () => void;
  busy: boolean;
}>;

/**
 * The bottom bar of the canvas (spec F-S4): the colourway and size selectors on the left, the
 * 2D | 3D | Tech pack toggle in the middle, and Simulate with its status chip on the right.
 * Shift-clicking a view, or the "and" checkbox, shows two views side by side.
 */
export function BottomBar(props: Props) {
  const colourwayId = useId();
  const sizeId = useId();
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2" data-testid="canvas-bottom-bar">
      <label htmlFor={colourwayId} className="sr-only">
        Colourway
      </label>
      <select id={colourwayId} value={props.colourwayId} onChange={(event) => props.onColourway(event.target.value)} className={SELECT}>
        {props.colourways.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={props.onNewColourway} disabled={props.busy} className={SMALL} data-testid="new-colourway">
        + New
      </button>
      <label htmlFor={sizeId} className="sr-only">
        Size shown
      </label>
      <select id={sizeId} value={props.size} onChange={(event) => props.onSize(event.target.value)} className={SELECT} data-testid="size-shown">
        {props.sizes.map((size) => (
          <option key={size} value={size}>
            Size {size}
          </option>
        ))}
      </select>
      <ViewToggle view={props.view} beside={props.beside} onView={props.onView} />
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={props.onSimulate} disabled={!props.simulate.canSimulate} className={SMALL} data-testid="simulate">
          Simulate
        </button>
        <span
          role="status"
          data-testid="simulate-chip"
          className={`inline-flex min-h-10 items-center rounded-full px-3 text-[13px] ${props.simulate.state === "ready" ? "text-ink-2" : "text-warn"}`}
        >
          {props.simulate.label}
        </span>
      </div>
    </div>
  );
}

type ToggleProps = Readonly<{ view: CanvasView; beside: CanvasView | null; onView: (view: CanvasView, alongside: boolean) => void }>;

function ViewToggle({ view, beside, onView }: ToggleProps) {
  return (
    <div role="group" aria-label="Canvas views" className="flex gap-1 rounded-full bg-tile-2/70 p-1" data-testid="view-toggle">
      {CANVAS_VIEWS.map((id) => {
        const on = showing(view, beside, id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={(event) => onView(id, event.shiftKey)}
            className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-full px-3 text-[13px] font-medium ${on ? "bg-cobalt text-white" : "text-chalk-muted hover:text-ink"}`}
          >
            {VIEWS[id].label}
          </button>
        );
      })}
      <label className="inline-flex min-h-10 items-center gap-2 px-2 text-[11px] text-chalk-muted">
        <input
          type="checkbox"
          checked={beside !== null}
          onChange={(event) => (event.target.checked ? onView(sideBySidePartner(view), true) : onView(view, false))}
          className="size-4 accent-cobalt"
        />
        Side by side
      </label>
    </div>
  );
}

/** The view that joins the one already shown when side by side is turned on: the next one along. */
const sideBySidePartner = (view: CanvasView): CanvasView => CANVAS_VIEWS[(CANVAS_VIEWS.indexOf(view) + 1) % CANVAS_VIEWS.length] as CanvasView;
