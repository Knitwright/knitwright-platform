import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec } from "@/lib/garment";
import { buildArtwork } from "../artwork";
import { buildColourways } from "../colourways";
import { buildLabelling } from "../labelling";
import { needsInput } from "./fields";
import { fromCell, section, tab, table, type TabView, type ViewRow } from "./rows";

/**
 * The **Artworks**, **Colourways**, **Personalisation** and **Labels & packaging** tabs (spec F-S6).
 *
 * Artworks and colourways are the design's own, so they are read through the tech pack's existing
 * builders (`buildArtwork`, `buildColourways`) rather than from the design object a second time: one
 * reading means the tab and the exported document cannot disagree about a graphic's size.
 *
 * Personalisation is "from base rules R-PER", says spec F-S6. The base article catalogue does not
 * carry the zones: `article.json` has a `personalisation` block and X1 seeded the article's POMs,
 * parameters, options, construction and fabrics, not that block. So each zone field says it is not
 * on file and carries the rulebook's own `R-PER-001`, and the Review tab counts it.
 *
 * Labels & packaging is "auto-generated per market". No destination market is stored against a
 * design, so the per-market table is not drawn from a guess: the five label fields the design does
 * hold are shown from the design, and the market table says which rule decides it.
 */

const PER_RULE = "R-PER-001";
const LABEL_RULE = "R-LAB-002";
const NO_ZONES = "The name and number zones are not on file for this base article yet. They come from the factory with the rules that fix them.";
const NO_MARKET = "No destination market is set on this design yet, so no market's label can be drawn.";

export function buildArtworks(spec: GarmentSpec): TabView {
  const art = buildArtwork(spec);
  const rows: readonly ViewRow[] = art.items.map((item) => ({
    id: `artwork-${item.id}`,
    label: item.name.status === "set" ? item.name.value : item.id,
    cells: [
      fromCell({ id: `artwork-${item.id}-name`, label: "Artwork" }, item.name),
      fromCell({ id: `artwork-${item.id}-technique`, label: "Type" }, item.technique),
      fromCell({ id: `artwork-${item.id}-panel`, label: "Panel" }, item.panel),
      fromCell({ id: `artwork-${item.id}-width`, label: "Width" }, item.width),
      fromCell({ id: `artwork-${item.id}-height`, label: "Height" }, item.height),
      fromCell({ id: `artwork-${item.id}-across`, label: "Across" }, item.across),
      fromCell({ id: `artwork-${item.id}-down`, label: "Down" }, item.down),
      fromCell({ id: `artwork-${item.id}-rotation`, label: "Angle" }, item.rotation),
    ],
  }));
  return tab("artworks", [
    section({
      id: "artworks",
      title: "Graphics and pattern fills",
      note: rows.length === 0 ? "This design has no graphic and no pattern fill yet." : null,
      tables: [
        table({
          id: "artwork-rows",
          title: "Artworks",
          columns: ["Artwork", "Type", "Panel", "Width", "Height", "Across", "Down", "Angle"],
          rows,
        }),
      ],
    }),
  ]);
}

export function buildColourwaysTab(spec: GarmentSpec, colourwayId: string): TabView {
  const built = buildColourways(spec);
  return tab(
    "colourways",
    built.colourways.map((way) =>
      section({
        id: `colourway-${way.id}`,
        title: way.id === colourwayId ? `${way.name} (shown on the canvas)` : way.name,
        tables: [
          table({
            id: `colourway-${way.id}-rows`,
            title: way.name,
            rowHeader: "Panel",
            columns: ["Colour reference", "Screen colour", "Swatch ID", "Delta-E tolerance"],
            rows: way.rows.map((row) => ({
              id: `colourway-${way.id}-${row.panelId}`,
              label: row.label,
              cells: [
                fromCell({ id: `colourway-${way.id}-${row.panelId}-code`, label: `${row.label}: colour reference`, ruleId: "R-SUB-004" }, row.code),
                fromCell({ id: `colourway-${way.id}-${row.panelId}-screen`, label: `${row.label}: screen colour`, ruleId: "R-SUB-004" }, row.screenColour),
                needsInput({ id: `colourway-${way.id}-${row.panelId}-swatch`, label: `${row.label}: swatch ID`, ruleId: "R-SUB-004" }),
                needsInput({ id: `colourway-${way.id}-${row.panelId}-delta`, label: `${row.label}: Delta-E tolerance`, ruleId: "R-SUB-005" }),
              ],
            })),
          }),
        ],
      }),
    ),
  );
}

export function buildPersonalisation(article: BaseArticle | null): TabView {
  const zones = ["Name on the back", "Number on the back", "Number on the front"];
  return tab("personalisation", [
    section({
      id: "zones",
      title: "Names and numbers",
      note: NO_ZONES,
      tables: [
        table({
          id: "zone-rows",
          title: "Zones",
          rowHeader: "Zone",
          columns: ["Panel", "Cap height", "Font", "Colour"],
          rows: zones.map((zone, index) => ({
            id: `zone-${index}`,
            label: zone,
            cells: [
              needsInput({ id: `zone-${index}-panel`, label: `${zone}: panel`, ruleId: PER_RULE }),
              needsInput({ id: `zone-${index}-height`, label: `${zone}: cap height`, ruleId: PER_RULE }),
              needsInput({ id: `zone-${index}-font`, label: `${zone}: font`, ruleId: "R-PER-003" }),
              needsInput({ id: `zone-${index}-colour`, label: `${zone}: colour`, ruleId: "R-PER-003" }),
            ],
          })),
          note: article === null ? NO_ZONES : null,
        }),
      ],
    }),
  ]);
}

export function buildLabels(spec: GarmentSpec): TabView {
  const labelling = buildLabelling(spec);
  return tab("labels", [
    section({
      id: "design-labels",
      title: "What this design says",
      fields: labelling.rows.map((row) => fromCell({ id: `label-${row.field}`, label: row.label, ruleId: LABEL_RULE }, row.value)),
    }),
    section({
      id: "markets",
      title: "Per destination market",
      note: NO_MARKET,
      fields: [
        needsInput({ id: "market", label: "Destination market", ruleId: LABEL_RULE }),
        needsInput({ id: "market-care", label: "Care label for that market", ruleId: LABEL_RULE }),
        needsInput({ id: "market-size", label: "Size label for that market", ruleId: LABEL_RULE }),
        needsInput({ id: "market-brand", label: "Brand label artwork", ruleId: "R-LAB-001" }),
      ],
    }),
  ]);
}
