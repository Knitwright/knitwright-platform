import { KIT_PATTERN_LABELS, type KitPattern } from "@/lib/garment";
import { tidy } from "./chain";
import { NEUTRAL_FILL, safeColour } from "./colour";
import { boundsOfPoints, flatten } from "./geometry";
import type { Bounds, FlatElement, FlatPath, PathCommand, Point, View } from "./model";

/**
 * A kit pattern drawn on the body of a top: hoops, stripes, a sash and so on. Each band is a
 * shape cut to the body's outline here, in the geometry, so the SVG and the PDF draw exactly
 * the same thing with no clipping of their own. The pieces are drawn straight after the body
 * panel and before the sleeves, so a sleeve covers what lies under it, and the body's outline
 * is drawn again on top so the pattern never hides the edge of the garment.
 */

/** A pattern colour with no swatch is drawn in this grey. */
export const PATTERN_FALLBACK = "#9aa3ae";

/** Band sizes a pattern is drawn with when nobody gave one, in tenths of a millimetre. They are never shown as a measurement. */
const DRAWN_SIZES = {
  hoops: 900,
  stripes: 700,
  pinstripes: 320,
  sash: 1100,
  "side-panels": 800,
  "chest-band": 900,
  fade: 0,
} as const;

/** How wide a pinstripe is drawn, and the share of a band each sash edging takes. */
const PIN_WIDTH = 28;
const SASH_EDGE = 0.14;
/** Where the fade starts, as a share of the body length from the top, and how many steps it takes. */
const FADE_START = 0.38;
const FADE_STEPS = 48;

export interface PatternPlace {
  readonly view: View;
  /** The lowest point of the armhole on the right of the page, which side panels and a chest band start from. */
  readonly underarm: Point;
}

interface Band {
  readonly shape: readonly Point[];
  readonly colour: string;
}

/** The area of a closed shape, positive when its points run one way and negative the other. */
function signedArea(points: readonly Point[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length] as Point;
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

const side = (a: Point, b: Point, point: Point): number => (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);

function crossing(from: Point, to: Point, a: Point, b: Point): Point {
  const along = side(a, b, from) / (side(a, b, from) - side(a, b, to));
  return { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
}

/**
 * The part of a shape inside a convex clip shape (Sutherland and Hodgman). The shape itself may
 * have dents, such as an armhole: where it leaves the clip and comes back, the two parts are
 * joined along the clip's edge by a line with no area, which a fill does not show.
 */
export function clipToConvex(subject: readonly Point[], clip: readonly Point[]): Point[] {
  const turn = Math.sign(signedArea(clip));
  let kept: Point[] = [...subject];
  for (let index = 0; index < clip.length && kept.length > 0; index += 1) {
    const a = clip[index] as Point;
    const b = clip[(index + 1) % clip.length] as Point;
    const inside = (point: Point): boolean => side(a, b, point) * turn >= 0;
    const input = kept;
    kept = [];
    input.forEach((point, at) => {
      const previous = input[(at + input.length - 1) % input.length] as Point;
      if (inside(point)) {
        if (!inside(previous)) kept.push(crossing(previous, point, a, b));
        kept.push(point);
      } else if (inside(previous)) {
        kept.push(crossing(previous, point, a, b));
      }
    });
  }
  return Math.abs(signedArea(kept)) > 1 ? kept : [];
}

const box = (left: number, top: number, right: number, bottom: number): Point[] => [
  { x: left, y: top },
  { x: right, y: top },
  { x: right, y: bottom },
  { x: left, y: bottom },
];

/** The pattern's colours as drawable values, main first. */
const inkOf = (pattern: KitPattern): string[] => pattern.colours.map((entry) => safeColour(entry.swatch) ?? PATTERN_FALLBACK);

const pick = (inks: readonly string[], index: number): string => inks[index % inks.length] as string;

const sizeOf = (pattern: KitPattern): number => pattern.size ?? DRAWN_SIZES[pattern.style];

function hoops(area: Bounds, size: number, inks: readonly string[]): Band[] {
  const bands: Band[] = [];
  for (let index = 1; area.minY + index * size < area.maxY; index += 2) {
    const top = area.minY + index * size;
    bands.push({ shape: box(area.minX - 1, top, area.maxX + 1, top + size), colour: pick(inks, (index - 1) / 2) });
  }
  return bands;
}

/** Vertical stripes, one on the centre line and the rest the same distance apart on both sides. */
function stripes(area: Bounds, size: number, inks: readonly string[]): Band[] {
  const reach = Math.max(-area.minX, area.maxX);
  const bands: Band[] = [];
  for (let step = 0; step * 2 * size - size / 2 < reach; step += 1) {
    for (const centre of step === 0 ? [0] : [-step * 2 * size, step * 2 * size]) {
      bands.push({ shape: box(centre - size / 2, area.minY - 1, centre + size / 2, area.maxY + 1), colour: pick(inks, step) });
    }
  }
  return bands;
}

function pinstripes(area: Bounds, size: number, inks: readonly string[]): Band[] {
  const reach = Math.max(-area.minX, area.maxX);
  const bands: Band[] = [];
  for (let step = 0; step * size < reach; step += 1) {
    for (const centre of step === 0 ? [0] : [-step * size, step * size]) {
      bands.push({ shape: box(centre - PIN_WIDTH / 2, area.minY - 1, centre + PIN_WIDTH / 2, area.maxY + 1), colour: pick(inks, step) });
    }
  }
  return bands;
}

/** A band along a line from `from` to `to`, `width` wide, pushed sideways by `shift`. */
function strip(from: Point, to: Point, width: number, shift: number): Point[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const normal = { x: -along.y, y: along.x };
  const at = (point: Point, out: number, offset: number): Point => ({
    x: point.x + normal.x * offset + along.x * out,
    y: point.y + normal.y * offset + along.y * out,
  });
  const [near, far] = [shift - width / 2, shift + width / 2];
  return [at(from, -width, near), at(to, width, near), at(to, width, far), at(from, -width, far)];
}

/**
 * A sash from one shoulder to the other hip. On the front it runs from the wearer's left
 * shoulder (the right of the page); on the back the same sash is seen from behind.
 */
function sash(area: Bounds, size: number, inks: readonly string[], view: View): Band[] {
  const width = area.maxX - area.minX;
  const turn = view === "front" ? 1 : -1;
  const from = { x: turn * width * 0.36, y: area.minY };
  const to = { x: -turn * width * 0.36, y: area.maxY };
  const main: Band = { shape: strip(from, to, size, 0), colour: pick(inks, 0) };
  if (inks.length < 2) return [main];
  const edge = size * SASH_EDGE;
  const offset = size / 2 + edge * 0.9;
  return [main, ...[-offset, offset].map((shift) => ({ shape: strip(from, to, edge, shift), colour: pick(inks, 1) }))];
}

/** A panel down each side from the underarm to the hem, with a thin edge in a second colour. */
function sidePanels(area: Bounds, size: number, inks: readonly string[], place: PatternPlace): Band[] {
  const top = place.underarm.y;
  const outer = area.maxX + 1;
  const panel = (inner: number, width: number): Point[] => [
    { x: place.underarm.x - inner - width, y: top },
    { x: outer, y: top },
    { x: outer, y: area.maxY + 1 },
    { x: area.maxX - inner - width, y: area.maxY + 1 },
  ];
  const mirror = (shape: readonly Point[]): Point[] => shape.map((point) => ({ x: -point.x, y: point.y }));
  const main = panel(0, size);
  const bands: Band[] = [main, mirror(main)].map((shape) => ({ shape, colour: pick(inks, 0) }));
  if (inks.length < 2) return bands;
  const edge = (shape: readonly Point[]): Point[] => [shape[0] as Point, { x: (shape[0] as Point).x + PIN_WIDTH * 1.5, y: top }, { x: (shape[3] as Point).x + PIN_WIDTH * 1.5, y: area.maxY + 1 }, shape[3] as Point];
  return [...bands, ...[edge(main), mirror(edge(main))].map((shape) => ({ shape, colour: pick(inks, 1) }))];
}

/** A band across the chest, ending a little above the underarm, with a thin stripe under it in a second colour. */
function chestBand(area: Bounds, size: number, inks: readonly string[], place: PatternPlace): Band[] {
  const bottom = place.underarm.y + size * 0.15;
  const main: Band = { shape: box(area.minX - 1, bottom - size, area.maxX + 1, bottom), colour: pick(inks, 0) };
  if (inks.length < 2) return [main];
  const gap = size * 0.12;
  return [main, { shape: box(area.minX - 1, bottom + gap, area.maxX + 1, bottom + gap + size * 0.18), colour: pick(inks, 1) }];
}

const channel = (colour: string, from: number): number => Number.parseInt(colour.slice(from, from + 2), 16);

/** The colour `share` of the way from one colour to another. */
export function mix(from: string, to: string, share: number): string {
  const part = (at: number): string =>
    Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * share)
      .toString(16)
      .padStart(2, "0");
  return `#${part(1)}${part(3)}${part(5)}`;
}

/**
 * A printed gradient from the body colour into the pattern colour at the hem, or through the
 * first into the second. Each step runs down to the hem and the next is drawn over it, so no
 * seam between steps shows the body colour through.
 */
function fade(area: Bounds, ground: string, inks: readonly string[]): Band[] {
  const start = area.minY + (area.maxY - area.minY) * FADE_START;
  const step = (area.maxY - start) / FADE_STEPS;
  const stops = [ground, ...inks];
  return Array.from({ length: FADE_STEPS }, (_, index) => {
    const at = ((index + 1) / FADE_STEPS) * (stops.length - 1);
    const leg = Math.min(Math.ceil(at) - 1, stops.length - 2);
    const colour = mix(stops[leg] as string, stops[leg + 1] as string, at - leg);
    const top = start + index * step;
    return { shape: box(area.minX - 1, top, area.maxX + 1, area.maxY + 1), colour };
  });
}

function bandsFor(pattern: KitPattern, area: Bounds, ground: string, place: PatternPlace): Band[] {
  const inks = inkOf(pattern);
  const size = sizeOf(pattern);
  switch (pattern.style) {
    case "hoops":
      return hoops(area, size, inks);
    case "stripes":
      return stripes(area, size, inks);
    case "pinstripes":
      return pinstripes(area, size, inks);
    case "sash":
      return sash(area, size, inks, place.view);
    case "side-panels":
      return sidePanels(area, size, inks, place);
    case "chest-band":
      return chestBand(area, size, inks, place);
    case "fade":
      return fade(area, ground, inks);
  }
}

/** The body's outline as one closed run of points: the longest closed run of its path. */
function outlineOf(commands: readonly PathCommand[]): readonly Point[] | null {
  const runs = flatten(commands).filter((run) => run.closed && run.points.length >= 3);
  const longest = runs.reduce<readonly Point[] | null>((best, run) => (best === null || run.points.length > best.length ? run.points : best), null);
  return longest;
}

const commandsOf = (points: readonly Point[]): PathCommand[] => [
  ...points.map((point, index): PathCommand => ({ op: index === 0 ? "M" : "L", to: { x: tidy(point.x), y: tidy(point.y) } })),
  { op: "Z" },
];

/** The pattern's pieces for one body panel, each cut to the body's outline. Nothing when the body has no closed outline. */
export function kitPatternElements(pattern: KitPattern, body: FlatPath, place: PatternPlace): FlatPath[] {
  const outline = outlineOf(body.commands);
  if (!outline) return [];
  const name = `Kit pattern: ${KIT_PATTERN_LABELS[pattern.style]}`;
  const ground = safeColour(body.fill) ?? NEUTRAL_FILL;
  return bandsFor(pattern, boundsOfPoints(outline), ground, place).flatMap((band): FlatPath[] => {
    const kept = clipToConvex(outline, band.shape);
    return kept.length === 0 ? [] : [{ kind: "path", name, panelId: null, commands: commandsOf(kept), fill: band.colour, stroke: null }];
  });
}

/**
 * The panels of one view with the kit pattern printed on the body: its pieces straight after
 * the body panel, then the body's outline again on top. Panels are unchanged with no pattern
 * or no body in this view.
 */
export function withKitPattern(panels: readonly FlatElement[], pattern: KitPattern | undefined, place: PatternPlace): readonly FlatElement[] {
  if (!pattern) return panels;
  const at = panels.findIndex((element) => element.kind === "path" && element.panelId === `body-${place.view}`);
  const body = panels[at];
  if (!body || body.kind !== "path") return panels;
  const drawn = kitPatternElements(pattern, body, place);
  if (drawn.length === 0) return panels;
  const edge: FlatPath = { ...body, name: `${body.name} outline`, panelId: null, fill: null };
  return [...panels.slice(0, at + 1), ...drawn, edge, ...panels.slice(at + 1)];
}
