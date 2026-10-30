"use client";

import { useState } from "react";
import type { PatternSheet, RingKind } from "@/lib/panel-layers/sheet";
import { pieceSummary, tickAt, zoomFor } from "@/lib/panel-layers/sheet-view";
import { WhyButton } from "../WhyButton";

/**
 * The parts of the 2D view that are not the canvas: the rulers, the line legend with its Why?
 * links, and the piece list that is the keyboard path and the drop target (plan v5 Y3, decision
 * 0076). A canvas is neither keyboard-reachable nor readable by a screen reader (decision 0053),
 * so everything the drawing shows is also here as text and as a button.
 */

/** The rulers along the top of the sheet. Decorative: the same numbers are in the piece list. */
export function Rulers({ sheet, widthPx }: Readonly<{ sheet: PatternSheet; widthPx: number }>) {
  const zoom = zoomFor(sheet.boundsMm, widthPx);
  return (
    <div aria-hidden="true" data-testid="view-2d-ruler" className="relative h-5 overflow-hidden border-b border-white/15 text-[9px] text-chalk-muted">
      {sheet.rulerX.map((tick) => (
        <span
          key={tick.mm}
          className="absolute bottom-0 border-l border-white/25"
          style={{ left: `${tickAt(tick, sheet.boundsMm.minX, zoom)}px`, height: tick.major ? "100%" : "40%" }}
        >
          {tick.label === null ? null : <span className="ml-1 align-top">{tick.label}</span>}
        </span>
      ))}
    </div>
  );
}

const LEGEND: Readonly<Record<RingKind, string>> = {
  bleed: "Bleed, outside the cut",
  cut: "Cut line",
  sew: "Sew line",
  safe: "Safe zone, inside the sewn edge",
};

/** What each line on the drawing is, with the distance it was drawn at and the rule that states it. */
export function Legend({ sheet }: Readonly<{ sheet: PatternSheet }>) {
  const kinds = [...new Set(sheet.pieces.flatMap((piece) => piece.rings.map((ring) => ring.kind)))];
  return (
    <ul data-testid="view-2d-legend" className="flex flex-col gap-1">
      {kinds.map((kind) => (
        <li key={kind} className="flex flex-wrap items-center gap-1 text-[11px] text-chalk-muted">
          <span className="font-medium text-ink">{LEGEND[kind]}.</span>
          {kind === "bleed" || kind === "cut" ? <span>{sheet.rules.bleed.note}</span> : null}
          {kind === "safe" || kind === "sew" ? <span>{sheet.rules.safeZone.note}</span> : null}
          <WhyButton ruleId={kind === "bleed" || kind === "cut" ? sheet.rules.bleed.ruleId : sheet.rules.safeZone.ruleId} context={`2D view ${kind} line`} />
        </li>
      ))}
      <li className="flex flex-wrap items-center gap-1 text-[11px] text-chalk-muted">
        <span className="font-medium text-ink">Scale bar.</span>
        <span>{sheet.scaleBar.note}</span>
        <span>{sheet.grid.note}</span>
      </li>
    </ul>
  );
}

type PieceListProps = Readonly<{
  sheet: PatternSheet;
  dragType: string;
  onDrop: (panelId: string, id: string | null) => void;
  busy: boolean;
}>;

/**
 * One row per piece: what it is in words, and the place a library item is dropped to put it on
 * that one panel. The Library toolbar has a panel picker beside every item for the keyboard.
 */
export function PieceList({ sheet, dragType, onDrop, busy }: PieceListProps) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <ul data-testid="view-2d-pieces" className="flex flex-col gap-1">
      {sheet.pieces.map((piece) => (
        <li
          key={piece.id}
          data-testid={`view-2d-piece-${piece.id}`}
          data-over={over === piece.id ? "true" : undefined}
          onDragOver={(event) => {
            if (busy || !event.dataTransfer.types.includes(dragType)) return;
            event.preventDefault();
            setOver(piece.id);
          }}
          onDragLeave={() => setOver((current) => (current === piece.id ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            setOver(null);
            onDrop(piece.id, event.dataTransfer.getData(dragType));
          }}
          className={`rounded-xl border px-3 py-2 text-[12px] leading-relaxed ${over === piece.id ? "border-cobalt text-ink" : "border-white/10 text-chalk-muted"}`}
        >
          {pieceSummary(piece)}
          {piece.notes.map((note) => (
            <span key={note} className="block text-[11px] text-warn">
              {note}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
