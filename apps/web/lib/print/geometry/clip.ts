import { FillRule, differenceD, intersectD, unionD } from "clipper2-ts";
import { offsetOutline, type OffsetJoin } from "@/lib/production/geometry/offset";
import type { Ring } from "../scene";

const PRECISION = 2;

type PathsD = Parameters<typeof differenceD>[0];

const toPaths = (rings: readonly Ring[]): PathsD => rings.map((ring) => ring.map(([x, y]) => ({ x, y })));
const fromPaths = (paths: PathsD): Ring[] => paths.filter((path) => path.length >= 3).map((path) => path.map((p): [number, number] => [p.x, p.y]));

/** The parts of `subjects` outside every ring of `holes`. Overlapping subjects are treated as one area (non-zero rule). */
export function subtractRings(subjects: readonly Ring[], holes: readonly Ring[]): Ring[] {
  if (holes.length === 0) return subjects.map((ring) => ring);
  return fromPaths(differenceD(toPaths(subjects), toPaths(holes), FillRule.NonZero, PRECISION));
}

/** The parts of `subjects` inside `clip`. */
export function intersectRings(subjects: readonly Ring[], clip: readonly Ring[]): Ring[] {
  return fromPaths(intersectD(toPaths(subjects), toPaths(clip), FillRule.NonZero, PRECISION));
}

/** One area from rings that touch or overlap. */
export function mergeRings(rings: readonly Ring[]): Ring[] {
  return fromPaths(unionD(toPaths(rings), FillRule.NonZero));
}

/** A ring grown outwards by `by` millimetres (shrunk when negative). */
export const growRing = (ring: Ring, by: number, join: OffsetJoin = "round"): Ring => offsetOutline(ring.map(([x, y]): [number, number] => [x, y]), by, join);
