"use client";

import type { ReactNode, Ref } from "react";
import { ELEMENT_SLOT_LABELS, type ElementSlotId, type PanelRow, type RailToolId, type StageViewId } from "@/lib/teamwear";
import type { RowHandlers } from "./PanelRows";
import { ToolRail, ViewChip } from "./StageControls";

/**
 * The frame the stage sits in: the 3D itself fills it, the tool rail runs down the left, the view
 * chip sits in the bottom-left corner, and the panel a rail button opens floats over it.
 *
 * The frame is the element that goes full screen, so the rail and the chip go with it.
 */

export type StageFrameProps = Readonly<{
  ref: Ref<HTMLDivElement>;
  views: readonly Readonly<{ id: StageViewId; label: string; showing: boolean }>[];
  onView: (view: StageViewId) => void;
  onTool: (tool: RailToolId) => void;
  disabled: Partial<Record<RailToolId, boolean>>;
  pressed: Partial<Record<RailToolId, boolean>>;
  /** Which rail panel is open, or null. */
  tool: "ideas" | "add-element" | null;
  /** What an unavailable tool says, or null. */
  toolNote: string | null;
  /** The part's rows, so the add-element panel can offer the element slots. */
  elements: readonly PanelRow[];
  handlers: RowHandlers;
  /** A sentence about the stage itself, such as a first render over its budget. */
  note: string | null;
  children: ReactNode;
}>;

function ToolPanel({ tool, toolNote, elements, handlers }: Pick<StageFrameProps, "tool" | "toolNote" | "elements" | "handlers">) {
  if (tool === null) return null;
  const slots = elements.find((row) => row.kind === "elements");
  return (
    <div
      className="absolute left-16 top-3 z-20 w-64 rounded-2xl border border-white/20 bg-black/70 p-3 text-sm text-white backdrop-blur-md"
      role="group"
      aria-label={tool === "ideas" ? "Ideas" : "Add an element"}
      data-testid={`teamwear-panel-${tool}`}
    >
      {tool === "ideas" ? (
        <p>{toolNote}</p>
      ) : slots === undefined || slots.kind !== "elements" ? (
        <p>This part has no element slots.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {slots.slots.map((slot) => (
            <label key={slot.id} className="flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                checked={slot.filled}
                onChange={(event) => handlers.setElement(slot.id as ElementSlotId, event.target.checked)}
                className="size-5"
                data-testid={`teamwear-element-${slot.id}`}
              />
              <span>{ELEMENT_SLOT_LABELS[slot.id as ElementSlotId]}</span>
            </label>
          ))}
          <p className="text-xs text-white/70">{slots.note}</p>
        </div>
      )}
    </div>
  );
}

export function StageFrame({ ref, children, ...props }: StageFrameProps) {
  return (
    <div ref={ref} className="relative flex min-h-[24rem] flex-1 flex-col overflow-hidden rounded-2xl bg-black/40" data-testid="teamwear-stage-frame">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <ToolRail onTool={props.onTool} disabled={props.disabled} pressed={props.pressed} />
      <ToolPanel tool={props.tool} toolNote={props.toolNote} elements={props.elements} handlers={props.handlers} />
      <ViewChip views={props.views} onView={props.onView} />
      {props.note === null ? null : (
        <p className="absolute left-16 bottom-3 max-w-xs rounded-xl bg-black/60 px-3 py-2 text-xs text-white" data-testid="teamwear-stage-note">
          {props.note}
        </p>
      )}
    </div>
  );
}
