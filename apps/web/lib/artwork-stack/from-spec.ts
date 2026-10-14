import { PLACE_DEFINITIONS, type Artwork, type GarmentSpec, type NamesAndNumbers } from "@/lib/garment";
import { withoutKitPattern } from "@/lib/garment/kit-pattern";
import { withoutMarks } from "@/lib/garment/names-numbers";
import { viewOfPanel, VIEW_IDS, type ViewId } from "./anchors";
import type { StackColour, StackColourway } from "./colours";
import { dotParamsOf, kitGeneratorId, sizeParamOf } from "./legacy/kit-styles";
import { panelColourId, toLegacy } from "./legacy/to-legacy";
import { DEFAULT_DATUM } from "./datum";
import type { GraphicLayer, GroundLayer, Layer, PatternLayer, PlayerMarkLayer, TextLayer } from "./layers";
import { ARTWORK_STACK_VERSION, type ArtworkStack } from "./schema";
import { mmFromTenths } from "./units";

/**
 * The migration path, with no data rewrite. A design saved before the stack has no `artworkStack`; this works
 * one out from its kit pattern, panel colours, artwork and player marks, every time it is read. The older
 * fields stay the truth until a stack-aware editor writes the stack (`writeStack`).
 */

const GROUND_FALLBACK = "ground";
const FLAT_VIEWS: readonly ViewId[] = ["front", "back"];
const FIXED = { opacity: 1, blend: "normal" } as const;

/** The colours of every colourway, each panel's colour keyed by the panel. */
function coloursOf(spec: GarmentSpec): { colours: StackColour[]; colourways: StackColourway[] } {
  const colourways = spec.colourways.map((colourway) => ({
    id: colourway.id,
    name: colourway.name,
    colours: Object.fromEntries(
      colourway.colours.map((entry) => [
        panelColourId(entry.panelId),
        {
          ...(entry.swatch === undefined ? {} : { screen: entry.swatch }),
          codes: entry.colour === "" ? [] : [{ system: "custom" as const, value: entry.colour, source: entry.provenance }],
          provenance: entry.provenance,
        },
      ]),
    ),
  }));
  const first = new Map<string, StackColour>();
  for (const colourway of colourways) {
    for (const [id, value] of Object.entries(colourway.colours)) {
      if (!first.has(id)) first.set(id, { id, role: "panel", ...value });
    }
  }
  return { colours: [...first.values()], colourways };
}

const groundLayer = (view: ViewId, known: ReadonlySet<string>): GroundLayer => {
  const wanted = panelColourId(`body-${view}`);
  return { ...FIXED, kind: "ground", id: `ground-${view}`, views: [view], colourId: known.has(wanted) ? wanted : GROUND_FALLBACK, provenance: "derived" };
};

function patternLayer(spec: GarmentSpec): { layer: PatternLayer; colours: StackColour[] } | null {
  const pattern = spec.kitPattern;
  if (pattern === undefined) return null;
  const colours = pattern.colours.map((entry, at): StackColour => ({
    id: `pattern-${at + 1}`,
    role: "pattern",
    ...(entry.swatch === undefined ? {} : { screen: entry.swatch }),
    codes: entry.colour === "" ? [] : [{ system: "custom", value: entry.colour, source: pattern.provenance }],
    provenance: pattern.provenance,
  }));
  const layer: PatternLayer = {
    ...FIXED,
    kind: "pattern",
    id: "kit-pattern",
    views: FLAT_VIEWS,
    generatorId: kitGeneratorId(pattern.style),
    params: { ...(pattern.size === undefined ? {} : { [sizeParamOf(pattern.style)]: mmFromTenths(pattern.size) }), ...dotParamsOf(pattern.dots) },
    datum: DEFAULT_DATUM,
    colourIds: colours.map((entry) => entry.id),
    ...(pattern.technique === undefined ? {} : { technique: pattern.technique }),
    provenance: pattern.provenance,
  };
  return { layer, colours };
}

function artworkLayer(art: Artwork): GraphicLayer | TextLayer {
  const placed = {
    ...FIXED,
    id: art.id,
    name: art.name,
    views: [viewOfPanel(art.panelId)],
    placement: { kind: "anchor", anchorId: art.anchor, panelId: art.panelId },
    offsetMm: { x: mmFromTenths(art.offsetX), y: mmFromTenths(art.offsetY) },
    widthMm: mmFromTenths(art.width),
    heightMm: mmFromTenths(art.height),
    rotationDeg: art.rotationDegrees,
    technique: art.technique,
    provenance: art.provenance,
  } as const;
  if (art.source.kind === "text") return { ...placed, kind: "text", text: art.source.text };
  return { ...placed, kind: "graphic", source: { kind: "file", fileId: art.source.fileId }, clearSpaceMm: 0, knockOut: false };
}

function markLayers(marks: NamesAndNumbers | undefined): { layers: PlayerMarkLayer[]; colour: StackColour | null } {
  if (marks === undefined) return { layers: [], colour: null };
  const colour: StackColour = {
    id: "player-marks",
    role: "player marks",
    ...(marks.swatch === undefined ? {} : { screen: marks.swatch }),
    codes: marks.colour === "" ? [] : [{ system: "custom", value: marks.colour, source: marks.provenance }],
    provenance: marks.provenance,
  };
  const layers = marks.places.map((entry): PlayerMarkLayer => ({
    ...FIXED,
    kind: "player-mark",
    id: `mark-${entry.place}`,
    views: [viewOfPanel(PLACE_DEFINITIONS[entry.place].panelId)],
    place: entry.place,
    ...(entry.height === undefined ? {} : { heightMm: mmFromTenths(entry.height) }),
    ...(marks.style === undefined ? {} : { style: marks.style }),
    colourId: colour.id,
    ...(marks.technique === undefined ? {} : { technique: marks.technique }),
    sample: { name: marks.sampleName, number: marks.sampleNumber },
    provenance: marks.provenance,
  }));
  return { layers, colour };
}

/** A stack made from the older fields of a design. Pure: the same design gives the same stack. A design with no pattern gives a ground-only stack. */
export function deriveStack(spec: GarmentSpec): ArtworkStack {
  const { colours: panelColours, colourways } = coloursOf(spec);
  const known = new Set(panelColours.map((entry) => entry.id));
  const pattern = patternLayer(spec);
  const marks = markLayers(spec.namesAndNumbers);
  const fallback: StackColour[] = FLAT_VIEWS.some((view) => !known.has(panelColourId(`body-${view}`)))
    ? [{ id: GROUND_FALLBACK, role: "ground", codes: [], provenance: "derived" }]
    : [];
  const layers: Layer[] = [
    ...FLAT_VIEWS.map((view) => groundLayer(view, known)),
    ...(pattern === null ? [] : [pattern.layer]),
    ...spec.artwork.map(artworkLayer),
    ...marks.layers,
  ];
  const used = new Set(layers.flatMap((layer) => layer.views));
  return {
    schemaVersion: ARTWORK_STACK_VERSION,
    views: VIEW_IDS.filter((view) => used.has(view) || FLAT_VIEWS.includes(view)),
    colours: [...panelColours, ...fallback, ...(pattern?.colours ?? []), ...(marks.colour === null ? [] : [marks.colour])],
    layers,
    colourways,
  };
}

/** Text with object keys in order, so two values that mean the same compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    return `{${entries.sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** True when the older fields still say what the stored stack says. An older editor changes only the older fields, so they can drift apart. */
export function inStep(spec: GarmentSpec, stack: ArtworkStack): boolean {
  const legacy = toLegacy(stack);
  return canonical([spec.kitPattern, spec.artwork, spec.namesAndNumbers, spec.colourways]) === canonical([legacy.kitPattern, legacy.artwork, legacy.namesAndNumbers, legacy.colourways]);
}

/**
 * The stack of a design. The stored stack when it agrees with the older fields; otherwise one worked out from them,
 * because the older fields are what an older editor changed last.
 */
export function currentStack(spec: GarmentSpec): ArtworkStack {
  const stored = spec.artworkStack;
  return stored !== undefined && inStep(spec, stored) ? stored : deriveStack(spec);
}

/**
 * Dual write: the design with this stack stored, and the older fields set from it, so the flats and the tech pack
 * that read them keep working. `specVersion` is the version of the design the stack was made from.
 */
export function writeStack(spec: GarmentSpec, stack: ArtworkStack, specVersion: number): GarmentSpec {
  const legacy = toLegacy(stack);
  const [firstColourway, ...otherColourways] = legacy.colourways.length === 0 ? spec.colourways : legacy.colourways;
  return {
    ...withoutKitPattern(withoutMarks(spec)),
    artwork: legacy.artwork,
    colourways: [firstColourway as GarmentSpec["colourways"][0], ...otherColourways],
    ...(legacy.kitPattern === undefined ? {} : { kitPattern: legacy.kitPattern }),
    ...(legacy.namesAndNumbers === undefined ? {} : { namesAndNumbers: legacy.namesAndNumbers }),
    artworkStack: { ...stack, derivedFrom: { specVersion } },
  };
}
