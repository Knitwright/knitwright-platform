"use client";

import { useRef, type KeyboardEvent } from "react";
import { RAIL_SEGMENTS, SEGMENTS, segmentKeyTarget, segmentPanelId, segmentTabId, type RailSegment } from "@/lib/editor";
import { LG, useMedia } from "../workspace/useMedia";

type Props = Readonly<{ segment: RailSegment; onChoose: (segment: RailSegment) => void }>;

/**
 * The segmented toggle at the top of the left rail: Form, Library, Specs (spec F-S4). A tab list,
 * like the tool rail below it: the arrow keys move between the toolbars and open each one, Home and
 * End jump to the ends, and Tab moves on into the open panel.
 *
 * IT STACKS ON A WIDE SCREEN, BECAUSE THE RAIL IT LIVES IN IS 4.75rem WIDE.
 *
 * Three words do not fit across 4.75rem. Side by side the strip is 8.5rem at its very narrowest --
 * three 2.5rem tabs, two 0.25rem gaps and 0.25rem of padding either side -- so it overflowed its
 * column to the right, across the gap and into the toolbar panel column beside it. The open panel
 * comes later in the document, which puts it above that overflow in the hit test, and it swallowed
 * every click meant for the **third** tab: Specs was on the screen, visible and enabled, and no
 * pointer could press it, so a person could not switch toolbars at all (PR #150, CI run
 * 41472099701). Only the keyboard path worked, which is why `editor-shell.spec.ts` -- which drives
 * this with the arrow keys -- never saw it.
 *
 * Upright from lg, the way the tool rail under it and the launch shell's icon rail both are: the
 * tabs are then 4.25rem wide inside a 4.75rem column and nothing leaves the box. The alternative
 * was to span the toggle across the rail and the panel, which reads better but takes 3.75rem of
 * height off the panel under it -- enough to push the Media tool's own panel out of sight, where
 * its `IntersectionObserver` never fires and it waits for ever (`useMediaScreen.ts`). The rail's
 * widths are decision 0075's, so widening it is the owner's call, not this change's (0117's owner
 * question 6).
 */
export function RailSegments({ segment, onChoose }: Props) {
  const tabs = useRef(new Map<RailSegment, HTMLButtonElement>());
  const wide = useMedia(LG);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = segmentKeyTarget(segment, event.key);
    if (!target) return;
    event.preventDefault();
    onChoose(target);
    tabs.current.get(target)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Toolbars"
      aria-orientation={wide ? "vertical" : "horizontal"}
      onKeyDown={move}
      data-testid="rail-segments"
      className="flex min-w-0 gap-1 rounded-2xl bg-tile-2/90 p-1 lg:flex-col"
    >
      {RAIL_SEGMENTS.map((id) => {
        const selected = id === segment;
        return (
          <button
            key={id}
            ref={(element) => {
              if (element) tabs.current.set(id, element);
              else tabs.current.delete(id);
            }}
            id={segmentTabId(id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={segmentPanelId(id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChoose(id)}
            className={`inline-flex min-h-10 min-w-10 flex-1 items-center justify-center rounded-xl px-1 text-[11px] font-medium lg:w-full lg:flex-none lg:min-w-0 ${
              selected ? "bg-cobalt text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {SEGMENTS[id].label}
          </button>
        );
      })}
    </div>
  );
}
