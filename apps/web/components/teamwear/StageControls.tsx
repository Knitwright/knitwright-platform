"use client";

import { RAIL_TOOLS, RAIL_TOOL_LABELS, STAGE_VIEW_LABELS, type RailToolId, type StageViewId } from "@/lib/teamwear";

/**
 * The furniture on the stage (spec F-T1): the vertical tool rail down the left and the view chip in
 * the bottom-left corner. Both are buttons with real names, so a screen reader and a test read the
 * same words a person sees; the marks beside them are decoration.
 */

/** One short mark per tool. They are hidden from a screen reader: the button's name carries the meaning. */
const MARKS: Readonly<Record<RailToolId, string>> = {
  undo: "↶",
  redo: "↷",
  "add-element": "＋",
  ideas: "💡",
  play: "▶",
  fullscreen: "⛶",
  snapshot: "📷",
};

export type ToolRailProps = Readonly<{
  onTool: (tool: RailToolId) => void;
  /** Tools that cannot be used now, such as undo with nothing behind it. */
  disabled: Partial<Record<RailToolId, boolean>>;
  /** Tools whose panel is open, or the turntable while it turns. */
  pressed: Partial<Record<RailToolId, boolean>>;
}>;

const RAIL_BUTTON =
  "flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/35 text-lg text-white backdrop-blur-md disabled:opacity-40 aria-pressed:bg-white/25";

export function ToolRail({ onTool, disabled, pressed }: ToolRailProps) {
  return (
    <div className="absolute left-3 top-3 flex flex-col gap-2" data-testid="teamwear-tool-rail">
      {RAIL_TOOLS.map((tool) => (
        <button
          key={tool}
          type="button"
          onClick={() => onTool(tool)}
          disabled={disabled[tool] ?? false}
          aria-pressed={pressed[tool] === undefined ? undefined : pressed[tool]}
          className={RAIL_BUTTON}
          data-testid={`teamwear-tool-${tool}`}
        >
          <span aria-hidden="true">{MARKS[tool]}</span>
          <span className="sr-only">{RAIL_TOOL_LABELS[tool]}</span>
        </button>
      ))}
    </div>
  );
}

export type ViewChipProps = Readonly<{
  views: readonly Readonly<{ id: StageViewId; label: string; showing: boolean }>[];
  onView: (view: StageViewId) => void;
}>;

/** The view chip: which side of the kit the stage is showing, and the four others to jump to. */
export function ViewChip({ views, onView }: ViewChipProps) {
  const showing = views.find((view) => view.showing);
  return (
    <div
      className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1 rounded-full border border-white/20 bg-black/40 p-1 backdrop-blur-md"
      role="group"
      aria-label={`View: ${showing ? showing.label : STAGE_VIEW_LABELS.front}`}
      data-testid="teamwear-view-chip"
      data-showing={showing?.id}
    >
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onView(view.id)}
          aria-current={view.showing ? "true" : undefined}
          className={`flex h-9 min-w-11 items-center justify-center rounded-full px-3 text-[13px] ${view.showing ? "bg-white text-black" : "text-white/80"}`}
          data-testid={`teamwear-view-${view.id}`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
