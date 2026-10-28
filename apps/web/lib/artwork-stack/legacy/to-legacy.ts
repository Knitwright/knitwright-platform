import {
  colourwaySchema,
  artworkSchema,
  kitPatternSchema,
  namesAndNumbersSchema,
  type Artwork,
  type Colourway,
  type KitPattern,
  type NamesAndNumbers,
} from "@/lib/garment";
import type { ColourValue } from "../colours";
import type { GraphicLayer, Layer, PatternLayer, PlayerMarkLayer, TextLayer } from "../layers";
import type { ArtworkStack } from "../schema";
import { tenthsFromMm } from "../units";
import { dotsLayoutOf, kitStyleOf, sizeParamOf } from "./kit-styles";

/** The fields of the older design that a stack stands in for. */
export interface LegacyFields {
  readonly kitPattern?: KitPattern;
  readonly artwork: readonly Artwork[];
  readonly namesAndNumbers?: NamesAndNumbers;
  readonly colourways: readonly Colourway[];
}

/** The id of the colour a panel has in every colourway: `panel-` and the panel's id. */
const PANEL_COLOUR_PREFIX = "panel-";
export const panelColourId = (panelId: string): string => `${PANEL_COLOUR_PREFIX}${panelId}`;

const colourOf = (stack: ArtworkStack, id: string | undefined): ColourValue | undefined => {
  const found = id === undefined ? undefined : stack.colours.find((entry) => entry.id === id);
  return found === undefined ? undefined : { screen: found.screen, codes: found.codes, provenance: found.provenance };
};
const textOf = (value: ColourValue | undefined): string => value?.codes[0]?.value ?? "";
const swatchOf = (value: ColourValue | undefined): { swatch?: string } => (value?.screen === undefined ? {} : { swatch: value.screen });
const techniqueOf = (layer: { readonly technique?: Artwork["technique"] }): { technique?: Artwork["technique"] } =>
  layer.technique === undefined ? {} : { technique: layer.technique };

function kitPatternOf(stack: ArtworkStack): KitPattern | undefined {
  const layer = stack.layers.find((entry): entry is PatternLayer => entry.kind === "pattern" && kitStyleOf(entry.generatorId) !== null);
  const style = layer === undefined ? null : kitStyleOf(layer.generatorId);
  if (layer === undefined || style === null) return undefined;
  const size = layer.params[sizeParamOf(style)];
  const dots = style === "dots" ? dotsLayoutOf(layer.params) : undefined;
  const candidate = {
    style,
    colours: layer.colourIds.map((id) => ({ colour: textOf(colourOf(stack, id)), ...swatchOf(colourOf(stack, id)) })),
    ...(typeof size === "number" ? { size: tenthsFromMm(size) } : {}),
    ...(dots === undefined ? {} : { dots }),
    ...techniqueOf(layer),
    provenance: layer.provenance,
  };
  const parsed = kitPatternSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

/** A graphic or text layer as an item of the older artwork list, when it can be written that way. */
function artworkOf(layer: GraphicLayer | TextLayer): Artwork | undefined {
  const { placement } = layer;
  const sized = { width: layer.widthMm, height: layer.heightMm };
  if (placement.kind !== "anchor" || placement.panelId === undefined || sized.width === undefined || sized.height === undefined) return undefined;
  const source = layer.kind === "text" ? { kind: "text" as const, text: layer.text } : layer.source.kind === "file" ? layer.source : undefined;
  if (source === undefined || layer.technique === undefined) return undefined;
  const parsed = artworkSchema.safeParse({
    id: layer.id,
    name: layer.name ?? (layer.kind === "text" ? layer.text : "Artwork"),
    source,
    panelId: placement.panelId,
    anchor: placement.anchorId,
    offsetX: tenthsFromMm(layer.offsetMm.x),
    offsetY: tenthsFromMm(layer.offsetMm.y),
    width: tenthsFromMm(sized.width),
    height: tenthsFromMm(sized.height),
    rotationDegrees: Math.round(layer.rotationDeg) % 360,
    technique: layer.technique,
    provenance: layer.provenance,
  });
  return parsed.success ? parsed.data : undefined;
}

function marksOf(stack: ArtworkStack): NamesAndNumbers | undefined {
  const marks = stack.layers.filter((entry): entry is PlayerMarkLayer => entry.kind === "player-mark");
  const first = marks[0];
  if (first?.sample === undefined) return undefined;
  const colour = colourOf(stack, first.colourId);
  const parsed = namesAndNumbersSchema.safeParse({
    places: marks.map((mark) => ({ place: mark.place, ...(mark.heightMm === undefined ? {} : { height: tenthsFromMm(mark.heightMm) }) })),
    ...(first.style === undefined ? {} : { style: first.style }),
    colour: textOf(colour),
    ...swatchOf(colour),
    ...techniqueOf(first),
    sampleName: first.sample.name,
    sampleNumber: first.sample.number,
    provenance: first.provenance,
  });
  return parsed.success ? parsed.data : undefined;
}

function colourwaysOf(stack: ArtworkStack): Colourway[] {
  return stack.colourways.flatMap((colourway) => {
    const colours = Object.entries(colourway.colours)
      .filter(([id]) => id.startsWith(PANEL_COLOUR_PREFIX))
      .map(([id, value]) => ({ panelId: id.slice(PANEL_COLOUR_PREFIX.length), colour: textOf(value), ...swatchOf(value), provenance: value.provenance }));
    const parsed = colourwaySchema.safeParse({ id: colourway.id, name: colourway.name, colours });
    return parsed.success ? [parsed.data] : [];
  });
}

const isArtwork = (layer: Layer): layer is GraphicLayer | TextLayer => layer.kind === "graphic" || layer.kind === "text";

/**
 * The older fields a stack stands in for. Anything the older fields cannot hold (a picture fill, a pattern
 * from the library, a graphic from an uploaded asset) is left out here and kept only in the stack.
 */
export function toLegacy(stack: ArtworkStack): LegacyFields {
  const kitPattern = kitPatternOf(stack);
  const namesAndNumbers = marksOf(stack);
  return {
    ...(kitPattern === undefined ? {} : { kitPattern }),
    artwork: stack.layers.filter(isArtwork).flatMap((layer) => artworkOf(layer) ?? []),
    ...(namesAndNumbers === undefined ? {} : { namesAndNumbers }),
    colourways: colourwaysOf(stack),
  };
}
