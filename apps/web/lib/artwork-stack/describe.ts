import { LETTERING_LABELS, PLACE_DEFINITIONS } from "@/lib/garment";
import { colourWords, resolveColour } from "./colours";
import type { Layer } from "./layers";
import type { PatternGenerator } from "./generator";
import { BUILT_IN_GENERATORS, findGenerator } from "./registry";
import type { ArtworkStack } from "./schema";
import { BAND_PARAM, DOT_PARAM } from "./legacy/kit-styles";

const spaced = (id: string): string => id.replaceAll("-", " ");
const mm = (value: number): string => `${Math.round(value * 10) / 10} mm`;

interface Words {
  readonly stack: ArtworkStack;
  readonly colourwayId: string | undefined;
  readonly generators: readonly PatternGenerator[];
}

const colourText = (words: Words, id: string | undefined): string => colourWords(id === undefined ? undefined : resolveColour(words.stack, words.colourwayId, id));

const where = (layer: Layer): string => {
  if (layer.kind !== "graphic" && layer.kind !== "text") return "";
  const { placement } = layer;
  return ` at ${spaced(placement.kind === "zone" ? placement.zoneId : placement.anchorId)}`;
};

function ground(words: Words): string {
  const grounds = words.stack.layers.flatMap((layer) => (layer.kind === "ground" ? [layer] : []));
  const text = grounds.map((layer) => ({ views: layer.views.join(" and "), colour: colourText(words, layer.colourId) }));
  if (text.length === 0) return "";
  if (new Set(text.map((entry) => entry.colour)).size === 1) return `Ground ${text[0]?.colour}.`;
  return `Ground ${text.map((entry) => `${entry.colour} on the ${entry.views}`).join(", ")}.`;
}

function patternSentence(layer: Extract<Layer, { kind: "pattern" }>, words: Words): string {
  const generator = findGenerator(layer.generatorId, words.generators);
  const colours = layer.colourIds.map((id) => colourText(words, id)).join(" and ");
  const band = layer.params[BAND_PARAM];
  const dot = layer.params[DOT_PARAM];
  const bits = [
    typeof band === "number" ? `bands ${mm(band)}` : "",
    typeof dot === "number" ? `dots ${mm(dot)} wide` : "",
    typeof layer.params.pitchMm === "number" ? `${mm(layer.params.pitchMm)} between centres` : "",
    layer.params.halfDrop === true ? "every other row shifted" : "",
    layer.seed === undefined ? "" : `seed ${layer.seed}`,
  ].filter((bit) => bit !== "");
  return `${generator?.label ?? spaced(layer.generatorId)} in ${colours}${bits.length === 0 ? "" : `, ${bits.join(", ")}`}.`;
}

function sentence(layer: Layer, words: Words): string {
  switch (layer.kind) {
    case "ground":
      return "";
    case "pattern":
      return patternSentence(layer, words);
    case "image-fill":
      return `${layer.mode === "tile" ? "A repeating picture" : "A full-panel picture"}${layer.halfDrop ? " in half-drop" : ""}.`;
    case "graphic":
      return `${layer.name ?? "Graphic"}${where(layer)}, ${mm(layer.widthMm)}.`;
    case "text":
      return `Text "${layer.text}"${where(layer)}, ${mm(layer.heightMm)} tall${layer.lettering === undefined ? "" : `, ${LETTERING_LABELS[layer.lettering].toLowerCase()} lettering`}.`;
    case "player-mark":
      return `${PLACE_DEFINITIONS[layer.place].label}${layer.style === undefined ? "" : `, ${LETTERING_LABELS[layer.style].toLowerCase()} lettering`}.`;
  }
}

/** The stack in plain English for the tech pack and the assistant: "Ground navy. Camo in three greens, seed 7. Club crest at left chest, 90 mm." */
export function describeStack(
  stack: ArtworkStack,
  colourwayId?: string,
  generators: readonly PatternGenerator[] = BUILT_IN_GENERATORS,
): string {
  const words: Words = { stack, colourwayId, generators };
  const read = stack.layers.some((layer) => layer.provenance === "read-from-image");
  const lines = [ground(words), ...stack.layers.map((layer) => sentence(layer, words))].filter((line) => line !== "");
  return [...lines, ...(read ? ["Read from a picture: compare it with the picture."] : [])].join(" ");
}
