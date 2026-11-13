"use client";

import { useRef, type KeyboardEvent } from "react";
import { RAIL_SEGMENTS, SEGMENTS, segmentKeyTarget, segmentPanelId, segmentTabId, type RailSegment } from "@/lib/editor";

type Props = Readonly<{
  /** The open toolbar, or null while a Garment Studio library panel is open in its place (decision 0150). */
  segment: RailSegment | null;
  onChoose: (segment: RailSegment) => void;
}>;

/**
 * The editor's three toolbars, Form, Library and Specs (spec F-S4), as a tab list: the arrow keys move
 * between them and open each one, Home and End jump to the ends, and Tab moves on into the open panel.
 *
 * In Garment Studio (plan v6 G1, decision 0150) it sits across the top of the 236 px library column,
 * where three words fit side by side. It stood upright while it lived in a 4.75rem rail, because
 * three words did not fit across that and the overflow swallowed the third tab's clicks (PR #150);
 * `editor-panels.spec.ts` still measures that nothing leaves the box. While one of the studio's
 * library panels is open, no toolbar is chosen and the first tab takes the tab stop.
 */
export function RailSegments({ segment, onChoose }: Props) {
  const tabs = useRef(new Map<RailSegment, HTMLButtonElement>());

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = segmentKeyTarget(segment ?? RAIL_SEGMENTS[0], event.key);
    if (!target) return;
    event.preventDefault();
    onChoose(target);
    tabs.current.get(target)?.focus();
  };

  return (
    <div role="tablist" aria-label="Toolbars" aria-orientation="horizontal" onKeyDown={move} data-testid="rail-segments" className="flex min-w-0 gap-0.5 rounded-md bg-soft p-1">
      {RAIL_SEGMENTS.map((id, index) => {
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
            tabIndex={selected || (segment === null && index === 0) ? 0 : -1}
            onClick={() => onChoose(id)}
            className={`inline-flex h-10 min-w-0 flex-1 lg:h-8 items-center justify-center rounded-sm px-2 text-small font-medium transition-colors duration-fast ${
              selected ? "bg-bg text-text shadow-e1" : "text-text-2 live:hover:text-text"
            }`}
          >
            {SEGMENTS[id].label}
          </button>
        );
      })}
    </div>
  );
}
