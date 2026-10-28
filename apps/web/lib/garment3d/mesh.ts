import { distanceToPolyline, flatten, type Polyline } from "@/lib/flat/geometry";
import type { Bounds, Point, View } from "@/lib/flat/model";
import type { ShapeSource } from "./shape";
import { insideLoop, openEdges, triangulateRegion, type Region } from "./triangulate";

/**
 * A 3D form made from the flat itself (step 9A). The silhouette of each view is split
 * into small triangles, each point is raised by a smooth function of its distance from
 * the edge, and the front and the back are joined along the outline. Each side is then
 * painted with its own flat, so the form changes whenever the flat does.
 *
 * It is a stylised form: it shows shape and colour, not fit or how fabric hangs.
 */


interface MeshInput {
  readonly front: ShapeSource;
  readonly back: ShapeSource;
}

/** One side of the form, laid out for a graphics card: flat lists of numbers. */
export interface MeshSheet {
  readonly side: View;
  /** x, y, z for each vertex, in metres. x runs to the wearer's left, y up, z towards the viewer of the front. */
  readonly positions: readonly number[];
  /** u, v for each vertex, into the picture of this side's flat. v runs up the picture. */
  readonly uvs: readonly number[];
  /** Three vertex indices for each triangle, anticlockwise when seen from outside. */
  readonly indices: readonly number[];
}

export interface GarmentMesh {
  readonly front: MeshSheet;
  readonly back: MeshSheet;
  /** The size of the whole form, in metres. */
  readonly size: { readonly width: number; readonly height: number; readonly depth: number };
}

/** The flat's units are tenths of a millimetre. */
export const METRES_PER_UNIT = 1e-4;

/** About this many triangles fit across the longer side of the garment. */
const DETAIL = 56;
/** How far the front and the back stand out, as a share of the greatest distance from the edge. */
const FRONT_DEPTH = 0.42;
const BACK_DEPTH = 0.36;
const SMOOTHING_PASSES = 10;
/** A point away from the edge always stands out a little, so front and back never touch inside. */
const LEAST_RISE = 1e-3;

function loopOf(source: ShapeSource, side: View): Point[] {
  const runs = flatten(source.outline.silhouette);
  const run = runs[0];
  if (runs.length !== 1 || !run?.closed || run.points.length < 3) throw new Error(`The outline of the ${side} is not one closed loop.`);
  const first = run.points[0] as Point;
  const last = run.points.at(-1) as Point;
  return first.x === last.x && first.y === last.y ? run.points.slice(0, -1) : [...run.points];
}

/** The stretches of the front outline that lie inside the back one, such as a deeper neck. */
function linesInside(front: readonly Point[], back: readonly Point[], tolerance: number): Point[][] {
  const border: Polyline = { points: back, closed: true };
  const inside = front.map((p) => insideLoop(p, back) && distanceToPolyline(p, border) > tolerance);
  const lines: Point[][] = [];
  front.forEach((p, i) => {
    if (!inside[i]) return;
    const continues = i > 0 && inside[i - 1];
    if (continues) lines.at(-1)?.push(p);
    else lines.push([p]);
  });
  return lines.filter((line) => line.length > 1);
}

/** Rises from nothing at the edge to 1 at distance `reach`, meeting the edge upright like a rounded rim. */
const profile = (distance: number, reach: number): number => {
  const t = Math.min(1, Math.max(0, distance / reach));
  return Math.sqrt(1 - (1 - t) * (1 - t));
};

function neighboursOf(count: number, region: Region): number[][] {
  const out: Set<number>[] = Array.from({ length: count }, () => new Set<number>());
  for (const [a, b, c] of region.triangles) {
    out[a]?.add(b).add(c);
    out[b]?.add(a).add(c);
    out[c]?.add(a).add(b);
  }
  return out.map((set) => [...set]);
}

/** Evens out the creases a distance field has, leaving the fixed points where they are. */
function smooth(heights: readonly number[], fixed: readonly boolean[], neighbours: readonly number[][]): number[] {
  let current = [...heights];
  for (let pass = 0; pass < SMOOTHING_PASSES; pass += 1) {
    const before = current;
    current = before.map((h, i) => {
      const around = neighbours[i] ?? [];
      if (fixed[i] || around.length === 0) return h;
      const mean = around.reduce((sum, j) => sum + (before[j] as number), 0) / around.length;
      return (h + mean) / 2;
    });
  }
  return current;
}

function usedPoints(region: Region): Region {
  const used = [...new Set(region.triangles.flat())].sort((a, b) => a - b);
  const index = new Map(used.map((old, i) => [old, i]));
  return {
    points: used.map((old) => region.points[old] as Point),
    triangles: region.triangles.map(([a, b, c]) => [index.get(a) as number, index.get(b) as number, index.get(c) as number] as const),
  };
}

interface Heights {
  readonly front: readonly number[];
  readonly back: readonly number[];
}

function heightsOf(region: Region, frontLoop: readonly Point[], backLoop: readonly Point[]): Heights {
  const seam = new Set(openEdges(region.triangles).flat());
  const frontBorder: Polyline = { points: frontLoop, closed: true };
  const backBorder: Polyline = { points: backLoop, closed: true };
  const toBack = region.points.map((p) => distanceToPolyline(p, backBorder));
  const reach = Math.max(...toBack);
  const toFront = region.points.map((p) => (insideLoop(p, frontLoop) ? distanceToPolyline(p, frontBorder) : 0));
  const rise = (distance: number, depth: number): number => depth * reach * Math.max(profile(distance, reach), LEAST_RISE);
  const neighbours = neighboursOf(region.points.length, region);
  const frontRaw = region.points.map((_, i) => (seam.has(i) || (toFront[i] as number) === 0 ? 0 : rise(toFront[i] as number, FRONT_DEPTH)));
  const backRaw = region.points.map((_, i) => (seam.has(i) ? 0 : -rise(toBack[i] as number, BACK_DEPTH)));
  return {
    front: smooth(frontRaw, frontRaw.map((h) => h === 0), neighbours),
    back: smooth(backRaw, region.points.map((_, i) => seam.has(i)), neighbours),
  };
}

const uvOf = (x: number, y: number, box: Bounds): [number, number] => [(x - box.minX) / (box.maxX - box.minX), 1 - (y - box.minY) / (box.maxY - box.minY)];

/**
 * The 3D form of a garment, from the outline of its front and its back. A pure function:
 * the same flats give the same form, and nothing it is given is changed.
 */
export function buildGarmentMesh(input: MeshInput): GarmentMesh {
  const frontLoop = loopOf(input.front, "front");
  const backLoop = loopOf(input.back, "back");
  const xs = backLoop.map((p) => p.x);
  const ys = backLoop.map((p) => p.y);
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const spacing = Math.max(box.maxX - box.minX, box.maxY - box.minY) / DETAIL;
  const region = usedPoints(triangulateRegion(backLoop, linesInside(frontLoop, backLoop, spacing / 4), spacing));
  const heights = heightsOf(region, frontLoop, backLoop);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const place = (z: readonly number[]) => region.points.flatMap((p, i) => [(p.x - cx) * METRES_PER_UNIT, -(p.y - cy) * METRES_PER_UNIT, (z[i] as number) * METRES_PER_UNIT]);
  const front: MeshSheet = {
    side: "front",
    positions: place(heights.front),
    uvs: region.points.flatMap((p) => uvOf(p.x, p.y, input.front.bounds)),
    // The triangles turn one way in the drawing's axes, where y runs down; turning y up reverses them.
    indices: region.triangles.flatMap(([a, b, c]) => [a, c, b]),
  };
  const back: MeshSheet = {
    side: "back",
    positions: place(heights.back),
    // The back flat is drawn as seen from behind, so its x runs the other way.
    uvs: region.points.flatMap((p) => uvOf(-p.x, p.y, input.back.bounds)),
    indices: region.triangles.flatMap(([a, b, c]) => [a, b, c]),
  };
  return {
    front,
    back,
    size: {
      width: (box.maxX - box.minX) * METRES_PER_UNIT,
      height: (box.maxY - box.minY) * METRES_PER_UNIT,
      depth: (Math.max(...heights.front) - Math.min(...heights.back)) * METRES_PER_UNIT,
    },
  };
}
