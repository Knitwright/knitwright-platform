"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorSlotProps } from "@/lib/editor/slots";
import { applyItem, runSteps } from "@/lib/panel-layers/apply";
import { DRAG_TYPE, itemFromDrag } from "@/lib/panel-layers/drag";
import { sheetRules } from "@/lib/panel-layers/sheet-rules";
import { gridStep } from "@/lib/panel-layers/sheet-view";
import { CANVAS_HINT, sheetFor } from "@/lib/panel-layers/view-2d";
import { WhyButton } from "../WhyButton";
import { Legend, PieceList, Rulers } from "./SheetParts";

/**
 * The 2D view of spec F-S4 (plan v5 Y3, decision 0076): a dotted grid with rulers, the pattern
 * pieces with their cut line, sew line, bleed and safe zone, and a 100 mm scale bar.
 *
 * It is a slot panel, so it is given `EditorSlotProps` and nothing else: the pieces are the ones
 * the drafter already made for the shown size, and every change goes back through `commands`. It
 * never fetches and never draws a shape nobody drafted — an article the platform cannot draft yet
 * says so, in the drafter's own words, with its Why?.
 */

const PatternCanvas = dynamic(() => import("./PatternCanvas"), { ssr: false });

const DEFAULT_WIDTH = 560;

/** The canvas is as wide as the panel it sits in, measured rather than guessed. */
function useWidth(): { ref: React.RefObject<HTMLDivElement | null>; widthPx: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [widthPx, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    watch.observe(element);
    return () => watch.disconnect();
  }, []);
  return { ref, widthPx };
}

export default function PatternView({ design, commands }: EditorSlotProps) {
  const rules = sheetRules();
  const view = sheetFor(design.draft, rules);
  const { ref, widthPx } = useWidth();
  const [said, setSaid] = useState<string | null>(null);

  const dropOn = useCallback(
    (panelId: string, id: string | null) => {
      const item = itemFromDrag(design, id);
      if (item === null) return setSaid("That is not something from your library, so nothing was changed.");
      setSaid(runSteps(applyItem(design, item, { kind: "panel", panelId }), commands));
    },
    [commands, design],
  );

  if (view.kind !== "sheet") {
    return (
      <section aria-label="2D pattern view" data-testid="view-2d" className="flex flex-col gap-2 rounded-2xl border border-white/10 p-4">
        <p className="text-[13px] leading-relaxed text-chalk-muted" data-testid="view-2d-none">
          {view.kind === "nothing" ? view.reason : "The form asks for a value this article does not offer, so nothing was drafted:"}
        </p>
        {view.kind === "invalid" ? (
          <ul className="list-disc pl-5 text-[13px] text-warn">
            {view.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        {view.kind === "nothing" && view.ruleId !== null ? <WhyButton ruleId={view.ruleId} context="2D view, nothing drafted" /> : null}
      </section>
    );
  }

  const { sheet } = view;
  const step = gridStep(sheet, widthPx);
  return (
    <section aria-label="2D pattern view" data-testid="view-2d" className="flex min-h-0 flex-col gap-2 overflow-y-auto">
      <p className="text-[13px] text-chalk-muted" data-testid="view-2d-hint">
        {CANVAS_HINT}
      </p>
      <Rulers sheet={sheet} widthPx={widthPx} />
      <div
        ref={ref}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-tile-2/60"
        style={
          step === null
            ? undefined
            : {
                backgroundImage: "radial-gradient(circle, rgba(232,234,240,0.22) 1px, transparent 1px)",
                backgroundSize: `${step}px ${step}px`,
              }
        }
      >
        <PatternCanvas sheet={sheet} widthPx={widthPx} />
      </div>
      <Legend sheet={sheet} />
      <PieceList sheet={sheet} dragType={DRAG_TYPE} onDrop={dropOn} busy={design.busy} />
      <p role="status" className="text-[13px] text-ink empty:hidden">
        {said}
      </p>
      {sheet.notes.map((note) => (
        <p key={note} className="text-[11px] text-chalk-muted">
          {note}
        </p>
      ))}
    </section>
  );
}
