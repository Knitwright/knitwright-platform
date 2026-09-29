import type { Bounds, FlatElement, FlatText, PathCommand, Point } from "./model";

/** A run of straight segments standing in for one sub-path of a path. */
export interface Polyline {
  readonly points: readonly Point[];
  readonly closed: boolean;
}

const CURVE_STEPS = 24;

function cubicAt(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return {
    x: w[0] * a.x + w[1] * c1.x + w[2] * c2.x + w[3] * b.x,
    y: w[0] * a.y + w[1] * c1.y + w[2] * c2.y + w[3] * b.y,
  };
}

/** Turns path commands into straight segments, splitting curves into small steps. */
export function flatten(commands: readonly PathCommand[]): readonly Polyline[] {
  const runs: { points: Point[]; closed: boolean }[] = [];
  let current: { points: Point[]; closed: boolean } | null = null;
  for (const command of commands) {
    if (command.op === "M") {
      current = { points: [command.to], closed: false };
      runs.push(current);
    } else if (current && command.op === "Z") {
      current.closed = true;
    } else if (current && command.op === "L") {
      current.points.push(command.to);
    } else if (current && command.op === "C") {
      const from = current.points.at(-1) as Point;
      for (let step = 1; step <= CURVE_STEPS; step += 1) {
        current.points.push(cubicAt(from, command.c1, command.c2, command.to, step / CURVE_STEPS));
      }
    }
  }
  return runs;
}

const EMPTY: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

const includePoint = (bounds: Bounds, point: Point): Bounds => ({
  minX: Math.min(bounds.minX, point.x),
  minY: Math.min(bounds.minY, point.y),
  maxX: Math.max(bounds.maxX, point.x),
  maxY: Math.max(bounds.maxY, point.y),
});

export const boundsOfPoints = (points: readonly Point[]): Bounds => points.reduce(includePoint, EMPTY);

export const grow = (bounds: Bounds, margin: number): Bounds => ({
  minX: bounds.minX - margin,
  minY: bounds.minY - margin,
  maxX: bounds.maxX + margin,
  maxY: bounds.maxY + margin,
});

export function rotateAbout(point: Point, centre: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return {
    x: centre.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: centre.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

/** The width of a letter, on average, as a share of the type size. Used only to leave room. */
const AVERAGE_LETTER_WIDTH = 0.62;

function textCorners(text: FlatText): Point[] {
  const width = text.text.length * text.size * AVERAGE_LETTER_WIDTH;
  const left = text.anchor === "start" ? 0 : text.anchor === "middle" ? -width / 2 : -width;
  const box = [
    { x: left, y: -text.size },
    { x: left + width, y: -text.size },
    { x: left + width, y: text.size * 0.3 },
    { x: left, y: text.size * 0.3 },
  ];
  const origin = { x: 0, y: 0 };
  return box
    .map((corner) => rotateAbout(corner, origin, text.rotation))
    .map((corner) => ({ x: corner.x + text.at.x, y: corner.y + text.at.y }));
}

function imageCorners(image: Extract<FlatElement, { kind: "image" }>): Point[] {
  const { at, width, height } = image;
  const corners = [
    { x: at.x - width / 2, y: at.y - height / 2 },
    { x: at.x + width / 2, y: at.y - height / 2 },
    { x: at.x + width / 2, y: at.y + height / 2 },
    { x: at.x - width / 2, y: at.y + height / 2 },
  ];
  return corners.map((corner) => rotateAbout(corner, at, image.rotation));
}

/** Every point an element covers, allowing for stroke width, rotation and the room text takes. */
export function extentPoints(element: FlatElement): readonly Point[] {
  if (element.kind === "text") return textCorners(element);
  if (element.kind === "image") return imageCorners(element);
  const half = (element.stroke?.width ?? 0) / 2;
  return flatten(element.commands)
    .flatMap((run) => run.points)
    .flatMap((p) => [
      { x: p.x - half, y: p.y - half },
      { x: p.x + half, y: p.y + half },
    ]);
}

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const SAME = 1e-6;
const samePoint = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < SAME && Math.abs(a.y - b.y) < SAME;

/** True when two segments cross at a point that is not just where they meet end to end. */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  if (samePoint(a, c) || samePoint(a, d) || samePoint(b, c) || samePoint(b, d)) return false;
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

type Segment = readonly [Point, Point];

function segmentsOf(run: Polyline): readonly Segment[] {
  const first = run.points[0];
  const points = run.closed && first ? [...run.points, first] : run.points;
  return points.slice(1).map((point, index): Segment => [points[index] as Point, point]);
}

/** True when the outline of any sub-path crosses itself, or two sub-paths cross each other. */
export function crossesItself(runs: readonly Polyline[]): boolean {
  const all = runs.flatMap((run, runIndex) => segmentsOf(run).map((segment, index) => ({ segment, runIndex, index })));
  return all.some((first, i) =>
    all.slice(i + 1).some((second) => {
      const neighbours = first.runIndex === second.runIndex && second.index - first.index === 1;
      return !neighbours && segmentsCross(first.segment[0], first.segment[1], second.segment[0], second.segment[1]);
    }),
  );
}

/** The shortest distance from a point to a run of segments. */
export function distanceToPolyline(point: Point, run: Polyline): number {
  return segmentsOf(run).reduce((best, [a, b]) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
    return Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
  }, Infinity);
}
