import type { PointMm } from "@/lib/artwork-stack/units";
import { roundMm } from "@/lib/artwork-stack/units";
import { budgetScale, defineGenerator, SIMPLIFIED_NOTE, type Tile } from "../define";
import { polygon } from "../geometry";
import type { GeneratorParam, Values } from "../params";
import { tileCount, tilesOver } from "../tiles";

const MOTIFS = ["chevron", "diamonds", "triangles", "hexagons"] as const;
const SQRT3 = Math.sqrt(3);

const PARAMS: readonly GeneratorParam[] = [
  { id: "motif", label: "Shape", unit: "none", min: 0, max: 3, step: 1, default: 0, choices: MOTIFS },
  { id: "size", label: "Shape size", noun: "shape", unit: "mm", min: 15, max: 120, step: 10, default: 40, words: { up: ["bigger", "larger", "wider"], down: ["smaller", "finer"] } },
  { id: "gap", label: "Space between shapes", noun: "gap", unit: "ratio", min: 0, max: 0.4, step: 0.04, default: 0.08, words: { up: ["looser", "more space", "spaced out"], down: ["tighter", "closer together"] } },
];

/** Whole tile for one motif at one size. Rounded to 0.01 mm, so copies are exactly one tile apart. */
function tileOf(values: Values): Tile {
  const s = values.size;
  switch (Math.round(values.motif)) {
    case 3:
      return { width: roundMm(3 * (s / 2)), height: roundMm(SQRT3 * (s / 2)) };
    case 2:
      return { width: roundMm(s), height: roundMm((SQRT3 / 2) * s) };
    default:
      return { width: roundMm(s), height: roundMm(s) };
  }
}

const scaleAbout = (points: readonly PointMm[], centre: PointMm, factor: number): PointMm[] =>
  points.map((point) => ({ x: centre.x + (point.x - centre.x) * factor, y: centre.y + (point.y - centre.y) * factor }));

const centroid = (points: readonly PointMm[]): PointMm => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
});

/** The motifs of one tile, as local points with the ink each takes (0 main, 1 second). */
function motifsOf(motif: number, t: Tile): { points: PointMm[]; ink: 0 | 1 }[] {
  const { width: w, height: h } = t;
  if (motif === 0) {
    const band = h * 0.3;
    const top = (h - band - w / 2) / 2;
    const zig = (offset: number): PointMm[] => [{ x: 0, y: top + offset }, { x: w / 2, y: top + w / 2 + offset }, { x: w, y: top + offset }];
    return [{ points: [...zig(0), ...zig(band).reverse()], ink: 0 }];
  }
  if (motif === 1) {
    const r = w / 2;
    const diamond = (cx: number, cy: number): PointMm[] => [{ x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }];
    return [{ points: diamond(w / 2, h / 2), ink: 0 }, { points: diamond(0, 0), ink: 1 }];
  }
  if (motif === 2) {
    return [
      { points: [{ x: 0, y: h }, { x: w / 2, y: 0 }, { x: w, y: h }], ink: 0 },
      { points: [{ x: w / 2, y: 0 }, { x: w * 1.5, y: 0 }, { x: w, y: h }], ink: 1 },
    ];
  }
  const radius = w / 3;
  const hex = (cx: number, cy: number): PointMm[] =>
    Array.from({ length: 6 }, (_, at) => ({ x: cx + radius * Math.cos((Math.PI / 3) * at), y: cy + radius * Math.sin((Math.PI / 3) * at) }));
  return [{ points: hex(0, 0), ink: 0 }, { points: hex(w / 2, h / 2), ink: 1 }];
}

/** A repeat of chevrons, diamonds, triangles or hexagons; one setting picks the shape. */
export const geometric = defineGenerator({
  id: "geometric",
  label: "Geometric shapes",
  summary: "Chevrons, diamonds, triangles or hexagons in a repeat.",
  aliases: ["geometric", "geometry", "chevron", "chevrons", "diamond", "diamonds", "triangle", "triangles", "hexagon", "hexagons"],
  params: PARAMS,
  maxColours: 2,
  tileFor: tileOf,
  draw({ context, values, inks }) {
    const base = tileOf(values);
    const motifs = motifsOf(Math.round(values.motif), base);
    const grow = budgetScale(tileCount(context.bounds, base, 2) * motifs.length);
    const tile = grow > 1 ? { width: roundMm(base.width * grow), height: roundMm(base.height * grow) } : base;
    const own = grow > 1 ? motifsOf(Math.round(values.motif), tile) : motifs;
    const shapes = tilesOver(context.bounds, tile, 2, context.datum).flatMap(({ origin }) =>
      own.map(({ points, ink }) => {
        const local = scaleAbout(points, centroid(points), 1 - values.gap);
        return polygon(local.map((point) => ({ x: origin.x + point.x, y: origin.y + point.y })), inks[ink] ?? inks[0], "Shape");
      }),
    );
    return { shapes, ...(grow > 1 ? { note: SIMPLIFIED_NOTE } : {}) };
  },
});
