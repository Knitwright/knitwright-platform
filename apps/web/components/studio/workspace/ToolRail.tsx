"use client";

import { useRef, type KeyboardEvent, type Ref } from "react";
import { createPortal } from "react-dom";
import { RAIL_TOOLS, TOOLS, railKeyTarget, type RailToolId, type ToolId } from "@/lib/workspace/tools";
import { ToolIcon } from "./ToolIcon";
import { panelId, tabId } from "./ToolPanels";
import { LG, useMedia } from "./useMedia";

type ToolRailProps = Readonly<{
  tool: ToolId;
  onChoose: (tool: ToolId) => void;
  /** Opens the assistant where it is not docked: phones, tablets and small laptops. */
  onAssistant: () => void;
  assistantOpen: boolean;
  assistantButton: Ref<HTMLButtonElement>;
}>;

/**
 * One icon for each group of controls. A tab list: the arrow keys move between tools and open
 * each one, Home and End jump to the ends, and Tab moves on into the open panel. Upright on a
 * wide screen; a bar along the bottom on a phone and a tablet.
 */
export function ToolRail({ tool, onChoose, onAssistant, assistantOpen, assistantButton }: ToolRailProps) {
  const tabs = useRef(new Map<RailToolId, HTMLButtonElement>());
  const wide = useMedia(LG);
  const onRail = (RAIL_TOOLS as readonly ToolId[]).includes(tool);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = railKeyTarget(tool, event.key);
    if (!target) return;
    event.preventDefault();
    onChoose(target);
    tabs.current.get(target)?.focus();
  };

  const rail = (
    <nav
      aria-label="Design tools"
      className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 rounded-t-3xl px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:min-h-0 lg:flex-col lg:rounded-3xl lg:p-1.5"
    >
      <div
        role="tablist"
        aria-label="Tools"
        aria-orientation={wide ? "vertical" : "horizontal"}
        onKeyDown={move}
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] lg:min-h-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
      >
        {RAIL_TOOLS.map((id, index) => {
          const selected = id === tool;
          return (
            <button
              key={id}
              ref={(element) => {
                if (element) tabs.current.set(id, element);
                else tabs.current.delete(id);
              }}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(id)}
              tabIndex={selected || (!onRail && index === 0) ? 0 : -1}
              onClick={() => onChoose(id)}
              className={`group flex min-h-10 min-w-[4.25rem] flex-none flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] transition-[background-color,color,transform] duration-300 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 lg:min-w-0 ${
                selected ? "bg-tile-2 text-white" : "text-chalk-muted hover:text-ink"
              }`}
            >
              <span className={`grid size-8 place-items-center rounded-[10px] ${selected ? "bg-cobalt text-white" : "bg-tile-2"}`}>
                <ToolIcon tool={id} size={18} />
              </span>
              {TOOLS[id].label}
            </button>
          );
        })}
      </div>
      <button
        ref={assistantButton}
        type="button"
        onClick={onAssistant}
        aria-expanded={assistantOpen}
        aria-controls="assistant-panel"
        className="flex min-h-10 flex-none flex-col items-center gap-1.5 rounded-2xl px-2 py-2 text-[11px] text-ink-2 hover:text-ink lg:mt-auto xl:hidden"
      >
        <span className="size-8 rounded-full bg-[linear-gradient(135deg,#b9c4ff,#ffd3e6_50%,#c7f0e4)]" aria-hidden="true" />
        Assistant
      </button>
    </nav>
  );
  // On a phone the bar is fixed to the bottom of the screen. The page rises into place with a
  // transform, which would pin it to the page instead, so it is drawn at the end of the body.
  return wide ? rail : createPortal(rail, document.body);
}
