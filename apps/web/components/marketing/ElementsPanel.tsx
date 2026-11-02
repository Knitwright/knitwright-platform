"use client";

import { useState } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import {
  ELEMENTS,
  ELEMENT_KINDS,
  ELEMENT_KIND_LABELS,
  NO_LIBRARY_NOTE,
  asSettings,
  elementsOfKind,
  selectedMarketing,
  shapeSlots,
  withFill,
  type MarketingElement,
} from "@/lib/marketing";
import { PANEL_CHIP, PanelFrame } from "./PanelFrame";

/**
 * THE ELEMENTS PANEL (spec Launch shell: "Elements (sport graphics)"; plan v5 L4, decision 0094).
 *
 * The shapes a kit layout is made of -- bands, sashes, chevrons, badges -- drawn by this platform,
 * in the brand's own colours. Nothing here is a licensed graphic, and the panel says so, so nobody
 * waits for artwork that is not coming.
 *
 * An element goes into one of the layout's shape slots, which keeps the lock true: there is no slot
 * over a mockup, so no element can ever be put on the garment.
 */
export default function ElementsPanel({ context, commands }: LaunchPanelProps) {
  const selected = selectedMarketing(context);
  const places = selected ? shapeSlots(selected.slots) : [];
  const [chosen, setChosen] = useState<string | null>(null);

  const place = (element: MarketingElement): void => {
    const slot = places[0];
    if (!selected || !slot) return;
    setChosen(element.id);
    commands.setBoardSettings(selected.board.id, asSettings(withFill(selected.settings, slot.id, element.id)));
  };

  return (
    <PanelFrame id="elements" ready={places.length > 0} busy={context.busy} onAction={() => commands.addBoard("marketing", { x: 0, y: 0 })}>
      {ELEMENT_KINDS.map((kind) => (
        <section key={kind} aria-label={ELEMENT_KIND_LABELS[kind]} className="flex flex-col gap-2">
          <h4 className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">{ELEMENT_KIND_LABELS[kind]}</h4>
          <ul className="flex flex-wrap gap-2">
            {elementsOfKind(kind).map((element) => (
              <li key={element.id}>
                <button
                  type="button"
                  disabled={context.busy}
                  aria-pressed={chosen === element.id}
                  onClick={() => place(element)}
                  className={`${PANEL_CHIP} gap-2`}
                  data-testid={`marketing-element-${element.id}`}
                >
                  <svg viewBox="0 0 1 1" aria-hidden="true" className="size-4 shrink-0">
                    <path d={element.path} fill="currentColor" />
                  </svg>
                  {element.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[12px] leading-relaxed text-ink-2">{NO_LIBRARY_NOTE}</p>
      <p className="text-[12px] leading-relaxed text-ink-2">
        {ELEMENTS.length} shapes. Each one takes the colour role of the slot it goes in, so your palette changes all of them at once.
      </p>
    </PanelFrame>
  );
}
