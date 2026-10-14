import { KIT_PATTERN_LABELS, KIT_PATTERN_STYLES, MAX_PATTERN_COLOURS, type KitPattern, type KitPatternStyle } from "@/lib/garment";
import { kitPatternElements, PATTERN_FALLBACK } from "@/lib/flat/kit-pattern";
import type { FlatPath, PathCommand, Point } from "@/lib/flat/model";
import type { DisplayPolygon, GeneratorContext, DisplayList, ParamSpec, PatternGenerator } from "../generator";
import { MM_LIMIT, mmFromTenths, tenthsFromMm, type PointMm } from "../units";

/**
 * The seven styles that exist today (hoops, stripes, pinstripes, sash, side panels, chest band, fade), each wrapped
 * as a generator. They call the drawing in `lib/flat/kit-pattern.ts` itself and only change units, so the output equals
 * today's drawing. That file is read, never edited.
 */

export const KIT_GENERATOR_PREFIX = "kit-";
export const kitGeneratorId = (style: KitPatternStyle): string => `${KIT_GENERATOR_PREFIX}${style}`;

/** The style a generator id names, or null when it is not one of the seven. */
export function kitStyleOf(generatorId: string): KitPatternStyle | null {
  return KIT_PATTERN_STYLES.find((style) => kitGeneratorId(style) === generatorId) ?? null;
}

export const BAND_PARAM = "bandWidthMm";

const BAND_WIDTH: ParamSpec = {
  id: BAND_PARAM,
  label: "Band width",
  unit: "mm",
  min: 0.1,
  max: MM_LIMIT,
  step: 0.5,
  default: null,
  words: { up: ["wider", "bigger", "thicker"], down: ["narrower", "smaller", "thinner"] },
};

const toTenths = (point: PointMm): Point => ({ x: point.x * 10, y: point.y * 10 });

const outlineOf = (context: GeneratorContext): FlatPath["commands"] => {
  const { minX, minY, maxX, maxY } = context.bounds;
  const points: readonly PointMm[] = context.clip ?? [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
  return [...points.map((point, at): PathCommand => ({ op: at === 0 ? "M" : "L", to: toTenths(point) })), { op: "Z" }];
};

/** Where side panels and a chest band start from. With no armhole given they sit a third of the way down; this is a drawing position, not a measurement. */
function underarmOf(context: GeneratorContext): Point {
  const found = context.landmarks.underarm;
  if (found !== undefined) return toTenths(found);
  const { maxX, minY, maxY } = context.bounds;
  return toTenths({ x: maxX, y: minY + (maxY - minY) / 3 });
}

function kitPatternOf(style: KitPatternStyle, context: GeneratorContext): KitPattern {
  const band = context.params[BAND_PARAM];
  return {
    style,
    colours: context.colours.map((swatch) => ({ colour: "", swatch })),
    ...(typeof band === "number" ? { size: tenthsFromMm(band) } : {}),
    provenance: "derived",
  };
}

function render(style: KitPatternStyle, context: GeneratorContext): DisplayList {
  const body: FlatPath = { kind: "path", name: "Body", panelId: null, commands: outlineOf(context), fill: context.ground, stroke: null };
  const view = context.view === "back" ? "back" : "front";
  const drawn = kitPatternElements(kitPatternOf(style, context), body, { view, underarm: underarmOf(context) });
  const shapes = drawn.map((path): DisplayPolygon => ({
    kind: "polygon",
    name: path.name,
    fill: path.fill ?? PATTERN_FALLBACK,
    points: path.commands.flatMap((command) => (command.op === "Z" ? [] : [{ x: mmFromTenths(command.to.x), y: mmFromTenths(command.to.y) }])),
  }));
  return { shapes };
}

const generator = (style: KitPatternStyle): PatternGenerator => ({
  id: kitGeneratorId(style),
  label: KIT_PATTERN_LABELS[style],
  params: style === "fade" ? [] : [BAND_WIDTH],
  repeat: { kind: "field" },
  maxColours: MAX_PATTERN_COLOURS,
  render: (context) => render(style, context),
});

export const KIT_STYLE_GENERATORS: readonly PatternGenerator[] = KIT_PATTERN_STYLES.map(generator);
