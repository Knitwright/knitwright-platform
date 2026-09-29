import { getType, type Artwork, type Colourway, type GarmentSpec } from "@/lib/garment";
import { choiceName, panelName } from "@/lib/garment/labels";
import type { View } from "@/lib/flat/model";

/**
 * The words sent with the flat to the image model. Plan step 14, task 2. A pure function
 * of the design, so the same design always asks for the same picture and a test can pin
 * it. The flat drawing is the reference; the words only name what the drawing cannot
 * show well (colour names, fabric) and forbid what the model likes to add.
 */

export const MAX_PROMPT_CHARS = 4000;

/** Longest piece of user text in the prompt. Colour names, fabric and artwork text. */
const PIECE_MAX = 120;

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/** User text made safe to quote: no control characters, no double quotes, one line, capped. */
export const cleanText = (text: string, max: number = PIECE_MAX): string =>
  text.replace(/\s+/g, " ").replace(CONTROL, "").replace(/"/g, "'").trim().slice(0, max);

const WEARER_WORDS: Readonly<Record<GarmentSpec["wearer"], string>> = {
  men: "men's",
  women: "women's",
  youth: "youth",
};

const colourwayOf = (spec: GarmentSpec, colourwayId?: string): Colourway =>
  spec.colourways.find((entry) => entry.id === colourwayId) ?? spec.colourways[0];

const optionLines = (spec: GarmentSpec): string[] => {
  const type = getType(spec.typeId);
  if (!type) return [];
  return type.options.flatMap((option) => {
    const chosen = spec.options[option.id];
    return chosen ? [`${option.label}: ${choiceName(option, chosen.choiceId)}`] : [];
  });
};

const colourLines = (spec: GarmentSpec, colourwayId?: string): string[] => {
  const type = getType(spec.typeId);
  if (!type) return [];
  return colourwayOf(spec, colourwayId).colours.map((entry) => {
    const name = cleanText(entry.colour);
    const colour = name && entry.swatch ? `${name} (${entry.swatch})` : name || entry.swatch || "";
    return `${panelName(type, entry.panelId)}: ${colour}`;
  });
};

const fabricLine = (spec: GarmentSpec): string | null => {
  const fabric = spec.fabrics[0];
  const parts = [
    cleanText(fabric.composition),
    fabric.weightGsm === null ? "" : `${fabric.weightGsm} gsm`,
    cleanText(fabric.finish),
  ].filter(Boolean);
  return parts.length > 0 ? `Fabric: ${parts.join(", ")}.` : null;
};

const artworkWords = (artwork: Artwork): string =>
  artwork.source.kind === "text"
    ? `the text "${cleanText(artwork.source.text)}" (${artwork.technique})`
    : `a logo from an uploaded file (${artwork.technique})`;

const artworkLine = (spec: GarmentSpec): string =>
  spec.artwork.length === 0
    ? "The garment has no logos, text or prints. Do not add any."
    : `Keep every logo, text and print exactly where and as large as the reference shows it: ${spec.artwork
        .map(artworkWords)
        .join("; ")}.`;

/**
 * A prompt for one view of a design. Throws for a garment type the registry does not
 * know: there is nothing true to say about it.
 */
export function buildImagePrompt(spec: GarmentSpec, view: View, colourwayId?: string): string {
  const type = getType(spec.typeId);
  if (!type) throw new Error(`There is no garment type called ${spec.typeId}.`);

  const colours = colourLines(spec, colourwayId);
  const lines = [
    `Photorealistic product photograph, ${view} view, of a ${WEARER_WORDS[spec.wearer]} ${type.label.toLowerCase()}, laid flat on a plain light grey background, soft even studio light.`,
    "The reference image is the technical flat drawing of this exact garment. Match its shape, proportions, seams, trims and every detail in it.",
    "Do not add anything the drawing does not show: no extra pockets, seams, panels, zips, buttons, labels, logos or text.",
    `Design: ${optionLines(spec).join("; ")}.`,
    colours.length > 0 ? `Colours: ${colours.join("; ")}.` : "Colours: as drawn in the reference.",
    fabricLine(spec),
    artworkLine(spec),
    "No person, no mannequin, no hanger, no props, no watermark.",
  ].filter((line): line is string => line !== null);

  return lines.join("\n").slice(0, MAX_PROMPT_CHARS);
}
