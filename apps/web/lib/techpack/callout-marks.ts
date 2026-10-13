import { circle, closedCommands, pt } from "@/lib/flat/chain";
import { CALLOUT_COLOUR } from "@/lib/flat/colour";
import { LAYERS, type Bounds, type FlatElement, type FlatLayer, type FlatPath, type FlatText, type Point } from "@/lib/flat/model";

/**
 * The marks that tie a drawing to the measurement table. Each line of a point of measure gets
 * a round mark with the point's code letter in it, the letter of the first column of the table.
 * The marks are sized from the drawing, so they can be read at the size the document prints
 * the drawing, and they are moved along their line until they do not cover one another.
 */

/** The radius of a mark, and the width of a line, as shares of the width of the drawing. */
const MARK_SHARE = 0.022;
const LINE_SHARE = 0.0018;
/** How far apart two marks must be, in radii, and where along its line a mark may sit, tried in order. */
const CLEARANCE = 2.3;
const PLACES = [0.5, 0.3, 0.7, 0.15, 0.85, 0.05, 0.95] as const;
const WHITE = "#ffffff";

export interface MarkSizes {
  readonly radius: number;
  readonly lineWidth: number;
}

/** The size of the marks for a drawing of these bounds. */
export function markSizes(bounds: Bounds): MarkSizes {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  return { radius: MARK_SHARE * width, lineWidth: LINE_SHARE * width };
}

/** The two ends of a straight callout line, or null for any other path. */
export function lineEnds(path: FlatPath): readonly [Point, Point] | null {
  const [first, second] = path.commands;
  if (first?.op !== "M" || second?.op !== "L") return null;
  return [first.to, second.to];
}

const along = ([from, to]: readonly [Point, Point], share: number): Point =>
  pt(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share);

/** Places off the line, beside its middle, tried when no place on the line is clear. */
function besideLine(ends: readonly [Point, Point], radius: number): readonly Point[] {
  const [from, to] = ends;
  const length = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  const across = pt(-(to.y - from.y) / length, (to.x - from.x) / length);
  const middle = along(ends, 0.5);
  return [1, -1, 2, -2, 3, -3].map((steps) => pt(middle.x + across.x * steps * CLEARANCE * radius, middle.y + across.y * steps * CLEARANCE * radius));
}

const nearest = (point: Point, placed: readonly Point[]): number =>
  placed.reduce((least, other) => Math.min(least, Math.hypot(other.x - point.x, other.y - point.y)), Number.POSITIVE_INFINITY);

/**
 * Where a mark goes: the middle of its line, or the nearest place along it that is clear of the
 * marks already placed, or else beside the line. When nothing is clear, the place furthest from
 * the other marks.
 */
export function placeMark(ends: readonly [Point, Point], placed: readonly Point[], radius: number): Point {
  const spots = [...PLACES.map((share) => along(ends, share)), ...besideLine(ends, radius)];
  const clear = spots.find((point) => nearest(point, placed) >= CLEARANCE * radius);
  return clear ?? spots.reduce((best, point) => (nearest(point, placed) > nearest(best, placed) ? point : best));
}

/** A round mark with a code in it: a white disc with a coloured ring, and the code in the middle. */
export function markElements(code: string, centre: Point, sizes: MarkSizes): readonly [FlatPath, FlatText] {
  const { radius } = sizes;
  const size = (code.length > 1 ? 0.85 : 1.15) * radius;
  return [
    {
      kind: "path",
      name: `${code} mark`,
      panelId: null,
      commands: closedCommands(circle(centre, radius)),
      fill: WHITE,
      stroke: { colour: CALLOUT_COLOUR, width: sizes.lineWidth, dash: [] },
    },
    { kind: "text", text: code, at: pt(centre.x, centre.y + 0.36 * size), size, anchor: "middle", colour: CALLOUT_COLOUR, rotation: 0 },
  ];
}

/** A callout line under its code's name, drawn wide enough to be seen in print. */
export const markedLine = (path: FlatPath, code: string, sizes: MarkSizes): FlatElement => ({
  ...path,
  name: `${code} line`,
  stroke: { colour: path.stroke?.colour ?? CALLOUT_COLOUR, dash: path.stroke?.dash ?? [], width: Math.max(path.stroke?.width ?? 0, sizes.lineWidth) },
});

/** Room kept round a mark at the edge of the drawing, as a share of its radius. */
const EDGE_ROOM = 0.4;

const isMark = (element: FlatElement): element is FlatPath => element.kind === "path" && element.name.endsWith(" mark");

/** The bounds of a drawing grown to hold every mark in its callout layer, so none is cut off at the edge. */
export function withMarks(bounds: Bounds, layers: readonly FlatLayer[], sizes: MarkSizes): Bounds {
  const points = layers
    .filter((layer) => layer.id === LAYERS.measurements.id)
    .flatMap((layer) => layer.elements)
    .filter(isMark)
    .flatMap((mark) => mark.commands.flatMap((command) => (command.op === "Z" ? [] : [command.to])));
  const room = EDGE_ROOM * sizes.radius;
  return points.reduce<Bounds>(
    (grown, point) => ({
      minX: Math.min(grown.minX, point.x - room),
      minY: Math.min(grown.minY, point.y - room),
      maxX: Math.max(grown.maxX, point.x + room),
      maxY: Math.max(grown.maxY, point.y + room),
    }),
    bounds,
  );
}
