"use client";

import { Canvas, Line, Polygon, Textbox } from "fabric";
import { useEffect, useRef } from "react";
import type { PatternSheet, SheetRing } from "@/lib/panel-layers/sheet";
import { heightFor, zoomFor } from "@/lib/panel-layers/sheet-view";

/**
 * The 2D pattern pieces on a Fabric.js canvas (decision 0053; plan v5 Y3, decision 0076). One
 * Fabric unit is one millimetre and the viewport is transformed to fit the sheet, so nothing here
 * converts units: the shapes are the sheet's own, exactly as `lib/panel-layers/sheet.ts` worked
 * them out, and every sum this file needs comes from `sheet-view.ts`.
 *
 * This file and the prototype's `components/panel-layers/PanelCanvas.tsx` are the only two that
 * import Fabric, and both are reached through `dynamic(..., { ssr: false })`, so the library is
 * fetched when a canvas opens and the server never evaluates it
 * (`components/panel-layers/fabric-isolation.test.ts` holds both rules).
 *
 * Nothing on this canvas can be selected or moved. The 2D view is a drawing of the pattern the
 * drafter made; a person changes the pattern through the Form toolbar, whose values the article's
 * approved ranges bound. The keyboard and screen-reader path is the piece list beside it.
 */

export type PatternCanvasProps = Readonly<{
  sheet: PatternSheet;
  widthPx: number;
}>;

/** How each line is drawn. Lighter and dashed as it gets further from the cut, as a pattern room draws it. */
const STROKES: Readonly<Record<SheetRing["kind"], { stroke: string; width: number; dash: readonly number[] | null }>> = {
  bleed: { stroke: "#7c8698", width: 1, dash: [12, 6] },
  cut: { stroke: "#e8eaf0", width: 2, dash: null },
  sew: { stroke: "#9aa6bd", width: 1, dash: [6, 4] },
  safe: { stroke: "#4f86f7", width: 1, dash: [3, 5] },
};

const INK = "#e8eaf0";

function ringShape(ring: SheetRing, mmPerPx: number): Polygon {
  const look = STROKES[ring.kind];
  return new Polygon(
    ring.points.map(([x, y]) => ({ x, y })),
    {
      fill: "transparent",
      stroke: look.stroke,
      strokeWidth: look.width * mmPerPx,
      strokeDashArray: look.dash === null ? null : look.dash.map((part) => part * mmPerPx),
      strokeUniform: true,
      objectCaching: false,
      selectable: false,
      evented: false,
      hoverCursor: "default",
    },
  );
}

/** The scale bar, in the bottom left of the sheet: a bar of known length and its own label. */
function scaleBar(sheet: PatternSheet, mmPerPx: number): readonly (Line | Textbox)[] {
  const x = sheet.boundsMm.minX + sheet.grid.mm;
  const y = sheet.boundsMm.maxY - sheet.grid.mm;
  const bar = new Line([x, y, x + sheet.scaleBar.mm, y], { stroke: INK, strokeWidth: 2 * mmPerPx, strokeUniform: true, selectable: false, evented: false });
  const label = new Textbox(`${sheet.scaleBar.mm} mm`, {
    left: x,
    top: y - 16 * mmPerPx,
    width: sheet.scaleBar.mm,
    fontSize: 12 * mmPerPx,
    fill: INK,
    fontFamily: "sans-serif",
    selectable: false,
    evented: false,
  });
  return [bar, label];
}

export default function PatternCanvas({ sheet, widthPx }: PatternCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const heightPx = heightFor(sheet.boundsMm, widthPx);

  useEffect(() => {
    const container = host.current;
    const element = document.createElement("canvas");
    container?.replaceChildren(element);
    const canvas = new Canvas(element, { width: widthPx, height: heightPx, selection: false, preserveObjectStacking: true });
    const zoom = zoomFor(sheet.boundsMm, widthPx);
    canvas.setViewportTransform([zoom, 0, 0, zoom, -sheet.boundsMm.minX * zoom, -sheet.boundsMm.minY * zoom]);
    // A stroke is asked for in device pixels, so its width in millimetres is the other way round.
    const mmPerPx = 1 / zoom;
    for (const piece of sheet.pieces) for (const ring of piece.rings) canvas.add(ringShape(ring, mmPerPx));
    for (const shape of scaleBar(sheet, mmPerPx)) canvas.add(shape);
    canvas.requestRenderAll();
    return () => {
      void canvas.dispose();
      container?.replaceChildren();
    };
  }, [sheet, widthPx, heightPx]);

  return <div ref={host} data-testid="pattern-canvas" style={{ width: widthPx, height: heightPx }} aria-hidden="true" />;
}
