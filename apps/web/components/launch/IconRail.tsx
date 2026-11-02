"use client";

import { useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { LG, useMedia } from "@/components/studio/workspace/useMedia";
import { RAIL, RAIL_ITEMS, railKeyTarget, railPanelId, railTabId, type RailId } from "@/lib/launch";
import { RailIcon } from "./LaunchIcon";

type Props = Readonly<{ open: RailId; onOpen: (id: RailId) => void }>;

/**
 * The left icon rail (spec Launch shell). A tab list, as the editor's tool rail is: the arrow keys
 * move between panels and open each one, Home and End jump to the ends, and Tab moves on into the
 * open panel. Upright on a wide screen; a bar along the bottom of the screen on a phone and a
 * tablet, which is the pattern this app already uses for the editor's rail.
 */
export function IconRail({ open, onOpen }: Props) {
  const tabs = useRef(new Map<RailId, HTMLButtonElement>());
  const wide = useMedia(LG);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = railKeyTarget(open, event.key);
    if (!target) return;
    event.preventDefault();
    onOpen(target);
    tabs.current.get(target)?.focus();
  };

  const rail = (
    <nav
      aria-label="Launch tools"
      data-testid="launch-rail"
      className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 rounded-t-3xl px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:min-h-0 lg:flex-col lg:rounded-3xl lg:p-1.5"
    >
      <div
        role="tablist"
        aria-label="Panels"
        aria-orientation={wide ? "vertical" : "horizontal"}
        onKeyDown={move}
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] lg:min-h-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
      >
        {RAIL_ITEMS.map((id) => {
          const selected = id === open;
          return (
            <button
              key={id}
              ref={(element) => {
                if (element) tabs.current.set(id, element);
                else tabs.current.delete(id);
              }}
              id={railTabId(id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={railPanelId(id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onOpen(id)}
              className={`group flex min-h-10 min-w-[4.25rem] flex-none flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] transition-[background-color,color,transform] duration-300 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 lg:min-w-0 ${
                selected ? "bg-tile-2 text-white" : "text-ink-2 hover:text-ink"
              }`}
            >
              <span className={`grid size-8 place-items-center rounded-[10px] ${selected ? "bg-cobalt text-white" : "bg-tile-2"}`}>
                <RailIcon id={id} />
              </span>
              {RAIL[id].label}
            </button>
          );
        })}
      </div>
    </nav>
  );

  // On a phone the bar is fixed to the bottom of the screen. The page rises into place with a
  // transform, which would pin the bar to the page instead, so it is drawn at the end of the body.
  return wide ? rail : createPortal(rail, document.body);
}
