"use client";

import { useRef, type KeyboardEvent } from "react";
import { RAIL_SEGMENTS, SEGMENTS, segmentKeyTarget, segmentPanelId, segmentTabId, type RailSegment } from "@/lib/editor";

type Props = Readonly<{ segment: RailSegment; onChoose: (segment: RailSegment) => void }>;

/**
 * The segmented toggle at the top of the left rail: Form, Library, Specs (spec F-S4). A tab list,
 * like the tool rail below it: the arrow keys move between the toolbars and open each one, Home and
 * End jump to the ends, and Tab moves on into the open panel.
 */
export function RailSegments({ segment, onChoose }: Props) {
  const tabs = useRef(new Map<RailSegment, HTMLButtonElement>());

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
      aria-orientation="horizontal"
      onKeyDown={move}
      data-testid="rail-segments"
      className="flex min-w-0 gap-1 rounded-2xl bg-tile-2/70 p-1"
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
            className={`inline-flex min-h-10 min-w-10 flex-1 items-center justify-center rounded-xl px-1 text-[11px] font-medium ${
              selected ? "bg-cobalt text-white" : "text-chalk-muted hover:text-ink"
            }`}
          >
            {SEGMENTS[id].label}
          </button>
        );
      })}
    </div>
  );
}
