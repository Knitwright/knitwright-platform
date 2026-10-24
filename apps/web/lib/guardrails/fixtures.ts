import { DEFAULT_SETTINGS } from "./settings";
import type { GuardrailInput, Panel, PlacedItem } from "./types";

/** A 500 x 700 mm test panel. A test shape, not a pattern. */
export const rectPanel = (id = "front", mirrorLines: Panel["mirrorLines"] = []): Panel => ({
  id,
  cutOutline: [[0, 0], [500, 0], [500, 700], [0, 700]],
  sewLine: [[10, 10], [490, 10], [490, 690], [10, 690]],
  mirrorLines,
});

export const item = (over: Partial<PlacedItem> & Pick<PlacedItem, "id" | "kind" | "box">): PlacedItem => ({
  label: over.id,
  panelId: "front",
  ...over,
});

export const typicalInput = (): GuardrailInput => ({
  panels: ["front", "back", "sleeve-left", "sleeve-right", "collar", "cuff"].map((id) => ({
    ...rectPanel(id),
    cutOutline: Array.from({ length: 200 }, (_, i) => [250 + 250 * Math.cos((i / 200) * 2 * Math.PI), 350 + 350 * Math.sin((i / 200) * 2 * Math.PI)] as [number, number]),
    sewLine: null,
  })),
  items: [
    item({ id: "crest", kind: "raster", widthPx: 400, box: { x0: 300, y0: 100, x1: 400, y1: 200 } }),
    item({ id: "sponsor", kind: "raster", widthPx: 2000, box: { x0: 150, y0: 250, x1: 350, y1: 300 } }),
    item({ id: "name", kind: "name", panelId: "back", box: { x0: 150, y0: 200, x1: 350, y1: 240 } }),
    item({ id: "number", kind: "number", panelId: "back", box: { x0: 175, y0: 260, x1: 325, y1: 440 } }),
    item({ id: "ground", kind: "fill", box: { x0: -20, y0: -20, x1: 520, y1: 720 } }),
  ],
  colours: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, label: `Colour ${i}`, hex: `#${(i * 32).toString(16).padStart(2, "0")}40a0` })),
  settings: DEFAULT_SETTINGS,
});
