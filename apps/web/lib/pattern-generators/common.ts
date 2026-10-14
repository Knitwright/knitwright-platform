import { hash32 } from "./rng";
import type { GeneratorContext, ParamSpec, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { BoundsMm } from "@/lib/artwork-stack/units";

/** A stand-in ink for a pattern handed no colours. It is never shown as a factory colour. */
export const FALLBACK_INK = "#808080";

/** A generator that is repeated from a tile says how big the tile is for a given set of settings. */
export interface TileGenerator extends PatternGenerator {
  readonly repeat: Extract<PatternGenerator["repeat"], { kind: "tile" }>;
  tileOf(params: Readonly<Record<string, number>>): { readonly width: number; readonly height: number };
}

export interface NumberParam {
  readonly id: string;
  readonly label: string;
  readonly unit: ParamSpec["unit"];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  readonly up: readonly string[];
  readonly down: readonly string[];
}

export const numberParam = (spec: NumberParam): ParamSpec => ({
  id: spec.id,
  label: spec.label,
  unit: spec.unit,
  min: spec.min,
  max: spec.max,
  step: spec.step,
  default: spec.default,
  words: { up: spec.up, down: spec.down },
});

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** Every setting as a number: the one given, kept within its range, else the default. A setting out of range never stops a drawing. */
export function valuesOf(specs: readonly ParamSpec[], given: GeneratorContext["params"]): Record<string, number> {
  return Object.fromEntries(
    specs.map((spec) => {
      const value = given[spec.id];
      const number = typeof value === "number" && Number.isFinite(value) ? value : typeof value === "boolean" ? Number(value) : (spec.default ?? spec.min);
      return [spec.id, clamp(number, spec.min, spec.max)];
    }),
  );
}

/** The pattern's colours, main first, repeated to fill `count` places. */
export function inksOf(context: GeneratorContext, count: number): string[] {
  const own = context.colours.length === 0 ? [FALLBACK_INK] : context.colours;
  return Array.from({ length: count }, (_, at) => own[at % own.length] as string);
}

/** How many of the wanted colours are really there. */
export const coloursAvailable = (context: GeneratorContext, wanted: number): number => Math.max(1, Math.min(wanted, context.colours.length));

export interface CellRange {
  readonly i0: number;
  readonly i1: number;
  readonly j0: number;
  readonly j1: number;
}

/** The cells of a lattice (origin, cell size) that touch the box grown by `margin`. */
export function cellsAround(box: BoundsMm, origin: { readonly x: number; readonly y: number }, cellW: number, cellH: number, margin = 0): CellRange {
  return {
    i0: Math.floor((box.minX - margin - origin.x) / cellW),
    i1: Math.floor((box.maxX + margin - origin.x) / cellW),
    j0: Math.floor((box.minY - margin - origin.y) / cellH),
    j1: Math.floor((box.maxY + margin - origin.y) / cellH),
  };
}

export const cellCount = (range: CellRange): number => (range.i1 - range.i0 + 1) * (range.j1 - range.j0 + 1);

export const boxWidth = (box: BoundsMm): number => box.maxX - box.minX;
export const boxHeight = (box: BoundsMm): number => box.maxY - box.minY;

const channel = (hex: string, at: number): number => Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
const isHex = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);
const toHex = (value: number): string => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

/** A colour part way between two `#rrggbb` colours. A colour that is not that form is kept as the first. */
export function mixHex(from: string, to: string, t: number): string {
  if (!isHex(from) || !isHex(to)) return from;
  const mixed = [0, 1, 2].map((at) => toHex(channel(from, at) + (channel(to, at) - channel(from, at)) * t));
  return `#${mixed.join("")}`;
}

/** A colour along a list of evenly spaced stops, `t` from 0 to 1. */
export function along(stops: readonly string[], t: number): string {
  if (stops.length === 1) return stops[0] as string;
  const scaled = clamp(t, 0, 1) * (stops.length - 1);
  const at = Math.min(stops.length - 2, Math.floor(scaled));
  return mixHex(stops[at] as string, stops[at + 1] as string, scaled - at);
}

/**
 * Where a lattice starts. Seed 0, the default, hangs it exactly from the datum; another seed slides it by up to one
 * cell, so the same settings can be shown with the repeat in a different place.
 */
export function seededOrigin(datum: { readonly x: number; readonly y: number }, seed: number, cellW: number, cellH: number): { x: number; y: number } {
  if (seed === 0) return { x: datum.x, y: datum.y };
  return { x: datum.x + (hash32(seed, 1) / 4294967296) * cellW, y: datum.y + (hash32(seed, 2) / 4294967296) * cellH };
}
