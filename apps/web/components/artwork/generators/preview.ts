import type { DisplayList, DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { GeneratorPreset } from "@/lib/pattern-generators/presets";

/** A swatch is a square of the design plane, in millimetres, big enough to show a few repeats. */
export const SWATCH_MM = 300;

const SWATCH_BOUNDS = { minX: 0, minY: 0, maxX: SWATCH_MM, maxY: SWATCH_MM } as const;

export interface SvgShape {
  readonly key: string;
  readonly tag: "polygon" | "circle";
  readonly fill: string;
  readonly points?: string;
  readonly cx?: number;
  readonly cy?: number;
  readonly r?: number;
}

const COLOURS = ["#1b2a49", "#d4af37", "#ffffff", "#2e7d32", "#a5d6a7"] as const;

const svgShape = (shape: DisplayShape, at: number): SvgShape =>
  shape.kind === "circle"
    ? { key: `s${at}`, tag: "circle", fill: shape.fill, cx: shape.centre.x, cy: shape.centre.y, r: shape.radius }
    : { key: `s${at}`, tag: "polygon", fill: shape.fill, points: shape.points.map((point) => `${point.x},${point.y}`).join(" ") };

export const svgShapes = (list: DisplayList): readonly SvgShape[] => list.shapes.map(svgShape);

/** What a gallery tile draws: the generator at a preset's settings, in the colours given (a stand-in set when none). */
export function previewOf(generator: PatternGenerator, preset: GeneratorPreset | undefined, colours: readonly string[] = COLOURS.slice(1)): { readonly ground: string; readonly shapes: readonly SvgShape[]; readonly note?: string } {
  const list = generator.render({
    view: "front",
    bounds: SWATCH_BOUNDS,
    landmarks: { underarm: { x: SWATCH_MM, y: SWATCH_MM / 2 } },
    datum: { x: 0, y: SWATCH_MM / 2 },
    colours,
    ground: COLOURS[0],
    params: preset?.params ?? {},
    seed: preset?.seed ?? 0,
  });
  return { ground: COLOURS[0], shapes: svgShapes(list), ...(list.note === undefined ? {} : { note: list.note }) };
}
