import { colourWords, findGenerator, resolveColour, type ArtworkStack, type Layer, type PatternLayer } from "@/lib/artwork-stack";
import { LETTERING_LABELS, PLACE_DEFINITIONS, PROVENANCE_LABELS, formatCm, TECHNIQUES } from "@/lib/garment";
import { GENERATORS } from "@/lib/pattern-generators/registry";
import type { LengthValue } from "../cell";
import type { LayerRow } from "./types-art";
import { ZONE_LABELS } from "./zone-labels";

const TECHNIQUE_WORDS: Readonly<Record<(typeof TECHNIQUES)[number], string>> = {
  sublimation: "Sublimation",
  transfer: "Transfer",
  "screen-print": "Screen print",
  embroidery: "Embroidery",
};

const KIND_WORDS: Readonly<Record<Layer["kind"], string>> = {
  ground: "Ground colour",
  pattern: "Pattern",
  "image-fill": "Repeating picture",
  graphic: "Placed picture",
  text: "Text",
  "player-mark": "Player name or number",
};

const spaced = (id: string): string => id.replaceAll("-", " ");
const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const cm = (mm: number): string => formatCm(Math.round(mm * 10));
const viewsOf = (views: readonly string[]): string => spaced(views.join(" and "));

export interface LayerContext {
  /** The technique of the whole design, used when a layer names none. */
  readonly technique?: string | null;
  readonly colourwayId?: string;
}

const whereOf = (layer: Layer): string => {
  switch (layer.kind) {
    case "ground":
    case "pattern":
      return `The whole of the ${viewsOf(layer.views)}`;
    case "image-fill":
      return layer.mode === "tile" ? `The whole of the ${viewsOf(layer.views)}` : `The whole panel of the ${viewsOf(layer.views)}`;
    case "player-mark":
      return PLACE_DEFINITIONS[layer.place].label;
    case "graphic":
    case "text": {
      const { placement } = layer;
      if (placement.kind === "anchor") return `${capital(spaced(placement.anchorId))}, a free anchor and not a standard zone`;
      return ZONE_LABELS[placement.zoneId as keyof typeof ZONE_LABELS] === undefined ? `${capital(spaced(placement.zoneId))} zone` : `${ZONE_LABELS[placement.zoneId as keyof typeof ZONE_LABELS]} zone`;
    }
  }
};

const clearSpaceOf = (layer: Layer): LengthValue | null =>
  layer.kind === "graphic" ? { status: "set", value: formatCm(Math.round(layer.clearSpaceMm * 10)), tenthsMm: Math.round(layer.clearSpaceMm * 10), provenance: layer.provenance } : null;

/** A setting as a person reads it: "30 mm", "yes". */
function valueWords(value: PatternLayer["params"][string] | undefined, unit: string | undefined): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return unit === "mm" || unit === "degrees" ? `${value} ${unit}` : String(value);
}

function patternDetail(layer: PatternLayer, stack: ArtworkStack, colourwayId: string | undefined): string {
  const generator = findGenerator(layer.generatorId, GENERATORS);
  const colours = layer.colourIds.map((id) => colourWords(resolveColour(stack, colourwayId, id)));
  const settings = Object.keys(layer.params)
    .sort()
    .map((id) => {
      const spec = generator?.params.find((entry) => entry.id === id);
      return `${spec?.label ?? id} ${valueWords(layer.params[id], spec?.unit)}`;
    });
  const seed = layer.seed === undefined ? [] : [`seed ${layer.seed}`];
  const bits = [...settings, ...seed];
  return `${generator?.label ?? spaced(layer.generatorId)} in ${colours.join(" and ")}${bits.length === 0 ? "" : `: ${bits.join(", ")}`}.`;
}

function detailOf(layer: Layer, stack: ArtworkStack, colourwayId: string | undefined): string {
  switch (layer.kind) {
    case "ground": {
      const words = colourWords(resolveColour(stack, colourwayId, layer.colourId));
      return `${capital(spaced(layer.colourId))}, ${words.charAt(0).toLowerCase()}${words.slice(1)}.`;
    }
    case "pattern":
      return patternDetail(layer, stack, colourwayId);
    case "image-fill":
      return layer.mode === "tile" ? `A repeating picture${layer.halfDrop ? ", every other row dropped by half a repeat" : ""}.` : "A picture covering the whole panel.";
    case "graphic":
      return `Picture width ${cm(layer.widthMm)} cm.`;
    case "text":
      return `The text "${layer.text}", ${cm(layer.heightMm)} cm tall${layer.lettering === undefined ? "" : `, ${LETTERING_LABELS[layer.lettering].toLowerCase()} lettering`}.`;
    case "player-mark": {
      const sample = layer.sample === undefined ? "" : `Sample ${layer.sample.name} ${layer.sample.number}. `;
      const height = layer.heightMm === undefined ? "" : ` Height ${cm(layer.heightMm)} cm.`;
      return `${sample}Each player's own name and number come from the team order.${height}`;
    }
  }
}

/** Every layer of the stack, bottom to top, with its kind, where it goes, its clear space, its method and where it came from. */
export function layerRows(stack: ArtworkStack, context: LayerContext): LayerRow[] {
  const designTechnique = context.technique === undefined || context.technique === null ? null : (TECHNIQUE_WORDS[context.technique as keyof typeof TECHNIQUE_WORDS] ?? capital(context.technique));
  return stack.layers.map((layer) => ({
    id: layer.id,
    name: layer.name ?? KIND_WORDS[layer.kind],
    kind: KIND_WORDS[layer.kind],
    views: viewsOf(layer.views),
    where: whereOf(layer),
    clearSpace: clearSpaceOf(layer),
    technique: layer.technique === undefined ? (designTechnique ?? "Not named") : TECHNIQUE_WORDS[layer.technique],
    provenance: PROVENANCE_LABELS[layer.provenance],
    detail: detailOf(layer, stack, context.colourwayId),
  }));
}
