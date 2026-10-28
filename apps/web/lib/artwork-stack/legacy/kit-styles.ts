import { KIT_PATTERN_LABELS, KIT_PATTERN_STYLES, MAX_PATTERN_COLOURS, type KitPattern, type KitPatternStyle } from "@/lib/garment";
import type { DotsLayout } from "@/lib/garment/kit-pattern";
import { kitPatternElements, PATTERN_FALLBACK } from "@/lib/flat/kit-pattern";
import type { FlatPath, PathCommand, Point } from "@/lib/flat/model";
import type { DisplayPolygon, GeneratorContext, DisplayList, ParamSpec, PatternGenerator } from "../generator";
import { MM_LIMIT, mmFromTenths, tenthsFromMm, type PointMm } from "../units";

/**
 * The seven styles that exist today (hoops, stripes, pinstripes, sash, side panels, chest band, fade), each wrapped
 * as a generator. They call the drawing in `lib/flat/kit-pattern.ts` itself and only change units, so the output equals
 * today's drawing. That file is read, never edited.
 */

const KIT_GENERATOR_PREFIX = "kit-";
export const kitGeneratorId = (style: KitPatternStyle): string => `${KIT_GENERATOR_PREFIX}${style}`;

/** The style a generator id names, or null when it is not one of the seven. */
export function kitStyleOf(generatorId: string): KitPatternStyle | null {
  return KIT_PATTERN_STYLES.find((style) => kitGeneratorId(style) === generatorId) ?? null;
}

export const BAND_PARAM = "bandWidthMm";
export const DOT_PARAM = "dotWidthMm";

/** The setting that holds the pattern's `size`: a band's width, or a dot's. */
export const sizeParamOf = (style: KitPatternStyle): string => (style === "dots" ? DOT_PARAM : BAND_PARAM);

const spacing = (id: string, label: string, min: number): ParamSpec => ({ id, label, unit: "mm", min, max: MM_LIMIT, step: 0.5, default: null });

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

/** The dots' own settings, one for each that the older design can hold. Their layout is in tenths of a millimetre there. */
const DOT_PARAMS: readonly ParamSpec[] = [
  { ...BAND_WIDTH, id: DOT_PARAM, label: "Dot width" },
  spacing("pitchMm", "Centre to centre", 5),
  spacing("rowStepMm", "Row to row", 5),
  { id: "halfDrop", label: "Every other row shifted", unit: "yes-no", min: 0, max: 1, step: 1, default: null },
  spacing("clearSpaceMm", "Clear space around marks", 0),
];

/** The dot spacing a design holds, as settings. */
export function dotParamsOf(layout: DotsLayout | undefined): Record<string, number | boolean> {
  if (layout === undefined) return {};
  return {
    ...(layout.pitch === undefined ? {} : { pitchMm: mmFromTenths(layout.pitch) }),
    ...(layout.rowStep === undefined ? {} : { rowStepMm: mmFromTenths(layout.rowStep) }),
    ...(layout.halfDrop === undefined ? {} : { halfDrop: layout.halfDrop }),
    ...(layout.clearSpace === undefined ? {} : { clearSpaceMm: mmFromTenths(layout.clearSpace) }),
  };
}

/** The dot spacing as a design holds it, or undefined when no setting is given. */
export function dotsLayoutOf(params: Readonly<Record<string, number | string | boolean>>): DotsLayout | undefined {
  const layout = {
    ...(typeof params.pitchMm === "number" ? { pitch: tenthsFromMm(params.pitchMm) } : {}),
    ...(typeof params.rowStepMm === "number" ? { rowStep: tenthsFromMm(params.rowStepMm) } : {}),
    ...(typeof params.halfDrop === "boolean" ? { halfDrop: params.halfDrop } : {}),
    ...(typeof params.clearSpaceMm === "number" ? { clearSpace: tenthsFromMm(params.clearSpaceMm) } : {}),
  };
  return Object.keys(layout).length === 0 ? undefined : layout;
}

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
  const size = context.params[sizeParamOf(style)];
  const dots = style === "dots" ? dotsLayoutOf(context.params) : undefined;
  return {
    style,
    colours: context.colours.map((swatch) => ({ colour: "", swatch })),
    ...(typeof size === "number" ? { size: tenthsFromMm(size) } : {}),
    ...(dots === undefined ? {} : { dots }),
    provenance: "derived",
  };
}

function render(style: KitPatternStyle, context: GeneratorContext): DisplayList {
  const body: FlatPath = { kind: "path", name: "Body", panelId: null, commands: outlineOf(context), fill: context.ground, stroke: null };
  const view = context.view === "back" ? "back" : "front";
  const drawn = kitPatternElements(kitPatternOf(style, context), body, { view, underarm: underarmOf(context), decoration: context.decoration });
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
  params: style === "fade" ? [] : style === "dots" ? DOT_PARAMS : [BAND_WIDTH],
  repeat: { kind: "field" },
  maxColours: MAX_PATTERN_COLOURS,
  render: (context) => render(style, context),
});

export const KIT_STYLE_GENERATORS: readonly PatternGenerator[] = KIT_PATTERN_STYLES.map(generator);
