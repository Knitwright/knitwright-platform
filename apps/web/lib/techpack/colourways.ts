import { panelsFor, type GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "@/lib/sizing";
import { TBC, textCell } from "./cell";
import { colourwayDrawing } from "./flats";
import type { ColourwayBlock, ColourwaysSection } from "./types";
import { SECTION_TITLES } from "./types";

/**
 * Each colourway with a row for each panel of the garment: the colour code a factory uses and
 * the colour drawn on screen, and a drawing of the front in that colourway. The two colours are
 * separate. A screen colour is never a colour code, so a panel with a screen colour and no code
 * has its code to be confirmed.
 */
export function buildColourways(spec: GarmentSpec, charts?: ChartSet): ColourwaysSection {
  const panels = panelsFor(spec);
  const colourways: readonly ColourwayBlock[] = spec.colourways.map((colourway) => ({
    id: colourway.id,
    name: colourway.name,
    rows: panels.map((panel) => {
      const entry = colourway.colours.find((colour) => colour.panelId === panel.id);
      return {
        panelId: panel.id,
        label: panel.label,
        code: entry ? textCell(entry.colour, entry.provenance) : TBC,
        screenColour: entry?.swatch === undefined ? TBC : textCell(entry.swatch, entry.provenance),
      };
    }),
    drawing: colourwayDrawing(spec, colourway.id, charts),
  }));
  const missing = colourways.some((block) =>
    block.rows.some((row) => row.code.status !== "set" || row.screenColour.status !== "set"),
  );
  return {
    id: "colourways",
    title: SECTION_TITLES.colourways,
    note: missing ? "Some colours are still to be confirmed." : null,
    colourways,
  };
}
