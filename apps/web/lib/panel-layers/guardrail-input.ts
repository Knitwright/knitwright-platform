import { bleedOutline, runGuardrails, DEFAULT_SETTINGS, type Finding, type GuardrailInput, type GuardrailSettings, type Panel, type PlacedItem } from "@/lib/guardrails";
import { resolveColour, type ArtworkStack, colourIdsOf } from "@/lib/artwork-stack";
import type { FabricDocJson, FabricObjectJson } from "./fabric-types";
import { frameOf, turnedBounds, type Rect } from "./geometry";

/** What is known about an uploaded picture. A picture not listed is treated as a raster of unknown pixel size, which the dpi check skips. */
export type AssetFacts = Readonly<Record<string, Readonly<{ kind: "raster" | "vector"; widthPx?: number }>>>;

const boundsOfPanel = (panel: Panel): Rect => {
  const frame = frameOf(panel.cutOutline);
  return { x0: frame.centre.x - frame.size.w / 2, y0: frame.centre.y - frame.size.h / 2, x1: frame.centre.x + frame.size.w / 2, y1: frame.centre.y + frame.size.h / 2 };
};

/** The box of the bleed region: the cut outline pushed outward, as the bleed check draws it. */
const bleedBox = (panel: Panel, bleedMm: number): Rect => {
  const xs = bleedOutline(panel.cutOutline, bleedMm).map((p) => p[0]);
  const ys = bleedOutline(panel.cutOutline, bleedMm).map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/** The box of an object on the canvas, turned by its angle. A text's height is its font size; Fabric works out lines itself. */
function boxOf(obj: FabricObjectJson): Rect {
  const height = obj.type === "Textbox" ? (obj.fontSize ?? obj.height) * obj.scaleY : obj.height * obj.scaleY;
  return turnedBounds({ x: obj.left, y: obj.top }, obj.width * obj.scaleX, height, obj.angle);
}

function itemOf(obj: FabricObjectJson, panel: Panel, facts: AssetFacts, bleedMm: number): PlacedItem | null {
  const { layer } = obj.kw;
  const base = { id: layer.id, label: layer.kind === "text" ? `Text "${layer.text}"` : (layer.name ?? layer.id), panelId: panel.id };
  switch (layer.kind) {
    case "ground":
    case "pattern":
      // A ground or pattern is a whole-view layer in design space (decision 0035), so it reaches the bleed.
      return { ...base, kind: "fill", box: bleedBox(panel, bleedMm) };
    case "image-fill":
      return { ...base, kind: "fill", box: layer.mode === "panel" && layer.fit === "contain" ? boundsOfPanel(panel) : bleedBox(panel, bleedMm) };
    case "graphic": {
      const known = layer.source.kind === "asset" ? facts[layer.source.assetId] : undefined;
      return { ...base, kind: known?.kind ?? "raster", box: boxOf(obj), ...(known?.widthPx === undefined ? {} : { widthPx: known.widthPx }) };
    }
    case "text":
      return { ...base, kind: "text", box: boxOf(obj) };
    case "player-mark":
      // Where a name or number sits needs the piece mapper (decision 0035), which is not built. It is not checked here.
      return null;
  }
}

/** The input the guardrails read, made from the live canvas of one panel. Pure. */
export function guardrailInput(
  stack: ArtworkStack,
  doc: FabricDocJson,
  panel: Panel,
  facts: AssetFacts,
  settings: GuardrailSettings = DEFAULT_SETTINGS,
): GuardrailInput {
  const layers = doc.objects.map((obj) => obj.kw.layer);
  const used = new Set(layers.flatMap(colourIdsOf));
  const colours = stack.colours.flatMap((entry) => {
    const hex = resolveColour(stack, stack.colourways[0]?.id, entry.id)?.screen;
    return used.has(entry.id) && hex !== undefined ? [{ id: entry.id, label: entry.role, hex }] : [];
  });
  const items = doc.objects.flatMap((obj) => itemOf(obj, panel, facts, settings.bleedMm.value) ?? []);
  return { panels: [panel], items, colours, settings };
}

/** Every finding for the canvas as it is now, blockers first. */
export const layerChecks = (
  stack: ArtworkStack,
  doc: FabricDocJson,
  panel: Panel,
  facts: AssetFacts,
  settings: GuardrailSettings = DEFAULT_SETTINGS,
): Finding[] => runGuardrails(guardrailInput(stack, doc, panel, facts, settings));
