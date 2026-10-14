import type { FlatElement } from "@/lib/flat/model";
import type { ViewId } from "./anchors";
import { roundMm, type BoundsMm, type PointMm } from "./units";

/** A shape in design millimetres. Fills are `#rrggbb`: the generator is handed resolved colours, so a colourway needs a new render, not a new layer. */
export interface DisplayPolygon {
  readonly kind: "polygon";
  readonly points: readonly PointMm[];
  readonly fill: string;
  readonly name?: string;
}
export interface DisplayCircle {
  readonly kind: "circle";
  readonly centre: PointMm;
  readonly radius: number;
  readonly fill: string;
  readonly name?: string;
}
export type DisplayShape = DisplayPolygon | DisplayCircle;

/** What a generator draws: device independent shapes in design millimetres, first drawn first. */
export interface DisplayList {
  readonly shapes: readonly DisplayShape[];
  /** Said when the generator left detail out to stay within its shape budget. */
  readonly note?: string;
}

export type ParamValue = number | string | boolean;
export const PARAM_UNITS = ["mm", "degrees", "count", "ratio", "yes-no", "none"] as const;

/** One setting of a generator. `words` are the plain words the assistant maps to a step up or down; it never invents a number. */
export interface ParamSpec {
  readonly id: string;
  readonly label: string;
  readonly unit: (typeof PARAM_UNITS)[number];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** The value used when nobody set one. Null when a drawing uses a stand-in that is never shown as a measurement. */
  readonly default: number | null;
  readonly words?: { readonly up: readonly string[]; readonly down: readonly string[] };
}

export type Repeat =
  | { readonly kind: "tile"; readonly tileMm: { readonly width: number; readonly height: number } }
  | { readonly kind: "field" };

/** Everything a render may depend on. Nothing else: no clock, no random number, no global. */
export interface GeneratorContext {
  readonly view: ViewId;
  readonly bounds: BoundsMm;
  /** The closed outline the pattern is cut to, when the caller has one. */
  readonly clip?: readonly PointMm[];
  /** Named places on the view that a style may start from, such as the underarm. */
  readonly landmarks: Readonly<Partial<Record<string, PointMm>>>;
  /** The repeat datum, as a point on the plane. */
  readonly datum: PointMm;
  /** The pattern's colours as screen colours, main first. */
  readonly colours: readonly string[];
  /** The colour under the pattern. */
  readonly ground: string;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly seed: number;
  /** The marks already drawn on this view, in flat units. Only the seven older styles and polka dots read it, to keep clear of them. */
  readonly decoration?: readonly FlatElement[];
}

/** The interface every pattern implements. Pure and deterministic: the same context gives the same list. */
export interface PatternGenerator {
  readonly id: string;
  readonly label: string;
  readonly params: readonly ParamSpec[];
  readonly repeat: Repeat;
  /** The most colours it uses. */
  readonly maxColours: number;
  render(context: GeneratorContext): DisplayList;
}

/** Plain sentences for settings that are not the generator's or are out of range. Empty when all is well. */
export function paramProblems(generator: Pick<PatternGenerator, "label" | "params">, values: Readonly<Record<string, ParamValue>>): string[] {
  return Object.entries(values).flatMap(([id, value]) => {
    const spec = generator.params.find((entry) => entry.id === id);
    if (spec === undefined) return [`${generator.label} has no setting called ${id}.`];
    if (spec.unit === "yes-no") return typeof value === "boolean" ? [] : [`${spec.label} must be yes or no.`];
    if (typeof value !== "number") return [`${spec.label} must be a number.`];
    return value < spec.min || value > spec.max ? [`${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit === "none" ? "" : spec.unit}`.trim() + "."] : [];
  });
}

/** The display list as text with every number at 0.01 mm: the same on any machine, so two runs can be compared. */
export function canonicalDisplayList(list: DisplayList): string {
  const num = (value: number): number => roundMm(value);
  return JSON.stringify(
    list.shapes.map((shape) =>
      shape.kind === "polygon"
        ? ["p", shape.fill, shape.points.map((point) => [num(point.x), num(point.y)])]
        : ["c", shape.fill, num(shape.centre.x), num(shape.centre.y), num(shape.radius)],
    ),
  );
}
