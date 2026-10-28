import type { DisplayList, DisplayShape, GeneratorContext, PatternGenerator } from "@/lib/artwork-stack/generator";
import { MAX_PATTERN_COLOURS_GUARD } from "./limits";
import { FALLBACK_INK } from "./colour";
import { boundsProblem } from "./bounds";
import { cullTo } from "./geometry";
import { createRng, hashSeed } from "./prng";
import { roundMm } from "@/lib/artwork-stack/units";
import { resolveParams, type GeneratorParam, type Values } from "./params";

/** Shapes one piece may hold before a generator simplifies (proposed in the plan; a setting, not a measurement). */
export const SHAPE_BUDGET = 20_000;
export const SIMPLIFIED_NOTE = "The pattern was drawn with larger shapes than asked for, to keep the print file light.";

/** How much to enlarge a cell or tile so that `estimate` shapes fit the budget. 1 when they already do. */
export const budgetScale = (estimate: number): number => (estimate <= SHAPE_BUDGET * 0.85 ? 1 : Math.sqrt(estimate / (SHAPE_BUDGET * 0.85)));

/** The shapes cut to the budget as a last guard, with the note that says so when any were left out. */
export function withinBudget(shapes: readonly DisplayShape[], note?: string): Drawn {
  if (shapes.length <= SHAPE_BUDGET) return note === undefined ? { shapes } : { shapes, note };
  return { shapes: shapes.slice(0, SHAPE_BUDGET), note: SIMPLIFIED_NOTE };
}

export interface Tile {
  readonly width: number;
  readonly height: number;
}

/** What a generator's drawing function is given: settings already inside their ranges, and colours padded to what it needs. */
export interface DrawInput {
  readonly context: GeneratorContext;
  readonly values: Values;
  /** The pattern's colours, main first; never empty. */
  readonly inks: readonly string[];
}

export interface Drawn {
  readonly shapes: readonly DisplayShape[];
  readonly note?: string;
}

/** A generator of this library: W7a's interface plus what the assistant and the gallery need. */
export interface LibraryGenerator extends PatternGenerator {
  readonly params: readonly GeneratorParam[];
  /** Other names people use for it, lower case ("camouflage"). */
  readonly aliases: readonly string[];
  readonly summary: string;
  /** The tile at these settings; only for repeat "tile". `repeat.tileMm` is the tile at the defaults. */
  readonly tileFor?: (values: Values) => Tile;
}

interface Definition {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly aliases: readonly string[];
  readonly params: readonly GeneratorParam[];
  readonly maxColours: number;
  readonly tileFor?: (values: Values) => Tile;
  /** How far apart the repeat of a field falls. A seed other than 0 moves the pattern by a seeded part of it, so a new seed is a new arrangement. Defaults to the tile. */
  readonly period?: (values: Values) => Tile;
  draw(input: DrawInput): Drawn;
}

const inksOf = (context: GeneratorContext, most: number): string[] => {
  const given = context.colours.slice(0, Math.min(most, MAX_PATTERN_COLOURS_GUARD));
  return given.length === 0 ? [FALLBACK_INK] : given;
};

/** The datum moved by a seeded part of one period. Seed 0 leaves it where it is. */
function shiftDatum(datum: GeneratorContext["datum"], period: Tile, seed: number): GeneratorContext["datum"] {
  if (seed === 0) return datum;
  const rng = createRng(hashSeed(seed, 0x5eed));
  return { x: roundMm(datum.x + rng.float() * period.width), y: roundMm(datum.y + rng.float() * period.height) };
}

export function defineGenerator(definition: Definition): LibraryGenerator {
  const { draw, tileFor, period, ...rest } = definition;
  const defaults = Object.fromEntries(definition.params.map((spec) => [spec.id, spec.default]));
  const tile = tileFor?.(defaults);
  return {
    ...rest,
    ...(tileFor === undefined ? {} : { tileFor }),
    repeat: tile === undefined ? { kind: "field" } : { kind: "tile", tileMm: { width: tile.width, height: tile.height } },
    render(context): DisplayList {
      const problem = boundsProblem(context.bounds);
      if (problem !== null) throw new Error(problem);
      const values = resolveParams(definition.params, context.params);
      const every = period ?? tileFor;
      const placed = every === undefined ? context : { ...context, datum: shiftDatum(context.datum, every(values), context.seed) };
      const drawn = draw({ context: placed, values, inks: inksOf(context, definition.maxColours) });
      const shapes = cullTo(drawn.shapes, context.bounds);
      return drawn.note === undefined ? { shapes } : { shapes, note: drawn.note };
    },
  };
}
