import { currentStack, type Layer } from "@/lib/artwork-stack";
import { LETTERING_LABELS, PLACE_DEFINITIONS, type GarmentSpec } from "@/lib/garment";
import { TECHNIQUE_CHOICES } from "@/lib/projects/artwork-controls";
import type { ElementKind, ElementSummary, ElementView, InspectorColourRow } from "./types";

/**
 * The layers on a garment as the inspector's element sections read them (plan v6 E3, decision 0147;
 * `08` §5.3 "Panel layer on a garment", e22–e25). The layers are the design's own artwork stack
 * (decision 0035), or the one worked out from the older fields while a design has none stored, so
 * the inspector shows exactly what the print files and the drawings use.
 *
 * Text is a text layer; a picture placed on a panel is an image; a pattern fill or a picture filling
 * a panel is an illustration (a repeat the garment is covered with); a player's name and number is a
 * player mark. The ground colour of a view is the panel's own colour and is not an element.
 */

const VIEW_LABELS: Readonly<Record<string, string>> = {
  front: "Front",
  back: "Back",
  "sleeve-left": "Sleeve L",
  "sleeve-right": "Sleeve R",
  collar: "Collar",
};

const TECHNIQUE_LABEL = new Map(TECHNIQUE_CHOICES.map((choice) => [choice.id, choice.label]));

/** Sublimation is the default print type (`08` §5.3): a layer that names none is sublimated. */
export const DEFAULT_PRINT_TYPE = "Sublimation";

type Shown = Exclude<Layer, { kind: "ground" }>;

const kindOf = (layer: Shown): ElementKind =>
  layer.kind === "text" ? "text" : layer.kind === "graphic" ? "image" : layer.kind === "player-mark" ? "player-mark" : "illustration";

const KIND_NAMES: Readonly<Record<ElementKind, string>> = {
  text: "Text",
  image: "Image",
  illustration: "Pattern fill",
  "player-mark": "Name and number",
};

const nameOf = (layer: Shown): string => {
  if (layer.name) return layer.name;
  if (layer.kind === "text") return layer.text;
  if (layer.kind === "player-mark") return PLACE_DEFINITIONS[layer.place].label;
  return KIND_NAMES[kindOf(layer)];
};

const shown = (spec: GarmentSpec): readonly Shown[] => currentStack(spec).layers.filter((layer): layer is Shown => layer.kind !== "ground");

/** Every element on the garment, top of the list first as a layers panel lists them. */
export const elementSummaries = (spec: GarmentSpec): readonly ElementSummary[] =>
  [...shown(spec)].reverse().map((layer) => ({ id: layer.id, kind: kindOf(layer), name: nameOf(layer) }));

const placementOf = (layer: Shown): string | null => {
  if (layer.kind === "player-mark") {
    const place = PLACE_DEFINITIONS[layer.place];
    return `Anchor: ${place.anchor} on ${place.panelId}`;
  }
  if (layer.kind !== "text" && layer.kind !== "graphic") return null;
  const placement = layer.placement;
  return placement.kind === "zone" ? `Zone: ${placement.zoneId}` : `Anchor: ${placement.anchorId}${placement.panelId ? ` on ${placement.panelId}` : ""}`;
};

const colourIdsOf = (layer: Shown): readonly string[] => {
  if (layer.kind === "text" || layer.kind === "player-mark") return layer.colourId ? [layer.colourId] : [];
  if (layer.kind === "pattern") return layer.colourIds;
  if (layer.kind === "image-fill") return layer.recolourIds ?? [];
  return [];
};

const round = (mm: number): number => Math.round(mm * 10) / 10;

function viewOf(layer: Shown, colours: ReadonlyMap<string, InspectorColourRow>): ElementView {
  const sized = layer.kind === "text" || layer.kind === "graphic" ? layer : null;
  const offset = layer.kind === "text" || layer.kind === "graphic" || layer.kind === "image-fill" ? layer.offsetMm : null;
  return {
    id: layer.id,
    kind: kindOf(layer),
    name: nameOf(layer),
    text: layer.kind === "text" ? layer.text : null,
    lettering:
      layer.kind === "text" && layer.lettering ? LETTERING_LABELS[layer.lettering] : layer.kind === "player-mark" && layer.style ? LETTERING_LABELS[layer.style] : null,
    views: layer.views.map((view) => VIEW_LABELS[view] ?? view).join(", "),
    placement: placementOf(layer),
    offset: offset === null ? null : { x: round(offset.x), y: round(offset.y) },
    widthMm: sized?.widthMm === undefined || sized === null ? null : round(sized.widthMm),
    heightMm: layer.kind === "player-mark" ? (layer.heightMm ?? null) : sized?.heightMm === undefined || sized === null ? null : round(sized.heightMm),
    rotationDeg: layer.kind === "text" || layer.kind === "graphic" || layer.kind === "image-fill" ? layer.rotationDeg : null,
    opacity: Math.round(layer.opacity * 100),
    blend: layer.blend,
    printType: layer.technique ? (TECHNIQUE_LABEL.get(layer.technique) ?? layer.technique) : DEFAULT_PRINT_TYPE,
    colours: colourIdsOf(layer).flatMap((id) => {
      const row = colours.get(id);
      return row ? [row] : [];
    }),
  };
}

/** What the inspector shows for each element, by layer id. */
export function elementViews(spec: GarmentSpec): Readonly<Record<string, ElementView>> {
  const stack = currentStack(spec);
  const colours = new Map<string, InspectorColourRow>(
    stack.colours.map((entry) => [entry.id, { id: entry.id, label: entry.role, hex: entry.screen ?? null, code: entry.codes[0]?.value ?? "" }]),
  );
  return Object.fromEntries(shown(spec).map((layer) => [layer.id, viewOf(layer, colours)]));
}
