import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pt } from "../geometry/vec";

/**
 * A small reader of TrueType outlines, so names and numbers can be turned into shapes and no font travels with a
 * print file. It reads only what is needed: the character map, glyph outlines (simple and composite), advance widths
 * and the capital height. It does not apply kerning or any shaping, which is why the lettering style is written in
 * words on the file and the bundled font is used (open question P8).
 */

export interface Glyph {
  /** Rings in font units, y up. Curves are already flattened to straight runs. */
  readonly rings: readonly (readonly Pt[])[];
  readonly advance: number;
}

export interface Font {
  readonly unitsPerEm: number;
  readonly capHeight: number;
  glyphFor(char: string): Glyph | null;
  readonly notdef: Glyph;
}

const FLATNESS_UNITS = 0.02;

class Reader {
  constructor(private readonly view: DataView) {}
  u8 = (o: number): number => this.view.getUint8(o);
  u16 = (o: number): number => this.view.getUint16(o);
  i16 = (o: number): number => this.view.getInt16(o);
  u32 = (o: number): number => this.view.getUint32(o);
}

interface Tables {
  readonly [tag: string]: number;
}

function tablesOf(r: Reader): Tables {
  const count = r.u16(4);
  const out: Record<string, number> = {};
  for (let i = 0; i < count; i += 1) {
    const o = 12 + i * 16;
    out[String.fromCharCode(r.u8(o), r.u8(o + 1), r.u8(o + 2), r.u8(o + 3))] = r.u32(o + 8);
  }
  return out;
}

/** Characters to glyph ids from a format 4 or format 12 subtable of the Unicode character map. */
function readCmap(r: Reader, base: number): Map<number, number> {
  const map = new Map<number, number>();
  const count = r.u16(base + 2);
  let chosen = -1;
  for (let i = 0; i < count; i += 1) {
    const [platform, encoding, offset] = [r.u16(base + 4 + i * 8), r.u16(base + 6 + i * 8), r.u32(base + 8 + i * 8)];
    const format = r.u16(base + offset);
    if (platform === 3 && encoding === 10 && format === 12) chosen = offset;
    else if (chosen < 0 && ((platform === 3 && encoding === 1) || platform === 0) && (format === 4 || format === 12)) chosen = offset;
  }
  if (chosen < 0) return map;
  const at = base + chosen;
  if (r.u16(at) === 12) {
    const groups = r.u32(at + 12);
    for (let g = 0; g < groups; g += 1) {
      const [start, end, glyph] = [r.u32(at + 16 + g * 12), r.u32(at + 20 + g * 12), r.u32(at + 24 + g * 12)];
      for (let c = start; c <= end && c - start < 70_000; c += 1) map.set(c, glyph + c - start);
    }
    return map;
  }
  const segs = r.u16(at + 6) / 2;
  const [endBase, startBase, deltaBase, rangeBase] = [at + 14, at + 16 + segs * 2, at + 16 + segs * 4, at + 16 + segs * 6];
  for (let s = 0; s < segs; s += 1) {
    const [end, start, delta, range] = [r.u16(endBase + s * 2), r.u16(startBase + s * 2), r.i16(deltaBase + s * 2), r.u16(rangeBase + s * 2)];
    for (let c = start; c <= end && c !== 0xffff; c += 1) {
      const glyph = range === 0 ? (c + delta) & 0xffff : r.u16(rangeBase + s * 2 + range + (c - start) * 2);
      if (glyph !== 0) map.set(c, range === 0 ? glyph : (glyph + delta) & 0xffff);
    }
  }
  return map;
}

interface RawPoint {
  readonly x: number;
  readonly y: number;
  readonly on: boolean;
}

/** One contour of on and off curve points to a closed run of straight lines. */
function flattenContour(points: readonly RawPoint[]): Pt[] {
  if (points.length < 3) return [];
  const start = points.findIndex((p) => p.on);
  const ordered = start < 0 ? points : [...points.slice(start), ...points.slice(0, start)];
  const seed: Pt = start < 0 ? [(points[0].x + points[points.length - 1].x) / 2, (points[0].y + points[points.length - 1].y) / 2] : [ordered[0].x, ordered[0].y];
  const out: Pt[] = [seed];
  let current = seed;
  let control: Pt | null = null;
  const quad = (a: Pt, c: Pt, b: Pt): void => {
    const dev = Math.hypot(a[0] - 2 * c[0] + b[0], a[1] - 2 * c[1] + b[1]) / 4;
    const n = Math.max(1, Math.min(48, Math.ceil(Math.sqrt(dev / FLATNESS_UNITS))));
    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      const u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
  };
  for (const p of start < 0 ? ordered : ordered.slice(1)) {
    const here: Pt = [p.x, p.y];
    if (p.on) {
      if (control === null) out.push(here);
      else quad(current, control, here);
      current = here;
      control = null;
    } else {
      if (control !== null) {
        const mid: Pt = [(control[0] + here[0]) / 2, (control[1] + here[1]) / 2];
        quad(current, control, mid);
        current = mid;
      }
      control = here;
    }
  }
  if (control !== null) quad(current, control, seed);
  return out;
}

function simpleGlyph(r: Reader, at: number, contours: number): Pt[][] {
  const ends: number[] = [];
  for (let i = 0; i < contours; i += 1) ends.push(r.u16(at + 10 + i * 2));
  const total = ends[contours - 1] + 1;
  let o = at + 10 + contours * 2;
  o += 2 + r.u16(o);
  const flags: number[] = [];
  while (flags.length < total) {
    const f = r.u8(o++);
    flags.push(f);
    if (f & 8) for (let n = r.u8(o++); n > 0; n -= 1) flags.push(f);
  }
  const read = (short: number, same: number): number[] => {
    const values: number[] = [];
    let v = 0;
    for (let i = 0; i < total; i += 1) {
      const f = flags[i];
      if (f & short) {
        const d = r.u8(o++);
        v += f & same ? d : -d;
      } else if (!(f & same)) {
        v += r.i16(o);
        o += 2;
      }
      values.push(v);
    }
    return values;
  };
  const xs = read(2, 16);
  const ys = read(4, 32);
  const rings: Pt[][] = [];
  let first = 0;
  for (const end of ends) {
    const pts: RawPoint[] = [];
    for (let i = first; i <= end; i += 1) pts.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) === 1 });
    const ring = flattenContour(pts);
    if (ring.length >= 3) rings.push(ring);
    first = end + 1;
  }
  return rings;
}

export async function loadBundledFont(): Promise<Font> {
  const file = join(process.cwd(), "assets", "fonts", "Geist-Regular.ttf");
  return parseFont(new Uint8Array(await readFile(file)));
}

export function parseFont(bytes: Uint8Array): Font {
  const r = new Reader(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const t = tablesOf(r);
  const unitsPerEm = r.u16(t.head + 18);
  const long = r.i16(t.head + 50) === 1;
  const glyphCount = r.u16(t.maxp + 4);
  const metrics = r.u16(t.hhea + 34);
  const cmap = readCmap(r, t.cmap);
  const locaAt = (g: number): number => (long ? r.u32(t.loca + g * 4) : r.u16(t.loca + g * 2) * 2);
  const advanceOf = (g: number): number => r.u16(t.hmtx + Math.min(g, metrics - 1) * 4);

  const outline = (g: number, depth = 0): Pt[][] => {
    if (g >= glyphCount || depth > 4) return [];
    const [from, to] = [locaAt(g), locaAt(g + 1)];
    if (from === to) return [];
    const at = t.glyf + from;
    const contours = r.i16(at);
    if (contours >= 0) return contours === 0 ? [] : simpleGlyph(r, at, contours);
    return compositeGlyph(at, depth);
  };

  const compositeGlyph = (at: number, depth: number): Pt[][] => {
    const rings: Pt[][] = [];
    let o = at + 10;
    for (;;) {
      const [flags, child] = [r.u16(o), r.u16(o + 2)];
      o += 4;
      let [dx, dy] = [0, 0];
      if (flags & 1) {
        [dx, dy] = [r.i16(o), r.i16(o + 2)];
        o += 4;
      } else {
        [dx, dy] = [(r.u8(o) << 24) >> 24, (r.u8(o + 1) << 24) >> 24];
        o += 2;
      }
      if (!(flags & 2)) [dx, dy] = [0, 0];
      let scale = 1;
      if (flags & 8) {
        scale = r.i16(o) / 16384;
        o += 2;
      } else if (flags & 0x40) o += 4;
      else if (flags & 0x80) o += 8;
      for (const ring of outline(child, depth + 1)) rings.push(ring.map(([x, y]): Pt => [x * scale + dx, y * scale + dy]));
      if (!(flags & 0x20)) return rings;
    }
  };

  const glyphs = new Map<number, Glyph>();
  const glyphOf = (g: number): Glyph => {
    let found = glyphs.get(g);
    if (found === undefined) {
      found = { rings: outline(g), advance: advanceOf(g) };
      glyphs.set(g, found);
    }
    return found;
  };
  const capHeight = ((): number => {
    const h = cmap.get(72);
    const ys = h === undefined ? [] : glyphOf(h).rings.flat().map((p) => p[1]);
    return ys.length === 0 ? unitsPerEm * 0.7 : Math.max(...ys) - Math.min(...ys);
  })();
  return {
    unitsPerEm,
    capHeight,
    notdef: glyphOf(0),
    glyphFor: (char) => {
      const code = char.codePointAt(0);
      const g = code === undefined ? undefined : cmap.get(code);
      return g === undefined ? null : glyphOf(g);
    },
  };
}

export interface TextOptions {
  /** The height of a capital, in millimetres. */
  readonly heightMm: number;
  readonly align?: "left" | "centre";
}

export interface TextResult {
  /** Shapes in millimetres, y up, with the baseline at y = 0 and the text starting at x = 0 (or centred on it). */
  readonly shapes: readonly (readonly (readonly Pt[])[])[];
  readonly width: number;
  /** Characters the font does not have. They are drawn as nothing and reported, never swapped for another letter. */
  readonly missing: readonly string[];
}

const scaleOf = (font: Font, heightMm: number): number => heightMm / font.capHeight;

export function textWidth(font: Font, text: string, heightMm: number): number {
  let units = 0;
  for (const char of text) units += (font.glyphFor(char) ?? font.notdef).advance;
  return units * scaleOf(font, heightMm);
}

export function textShapes(font: Font, text: string, options: TextOptions): TextResult {
  const k = scaleOf(font, options.heightMm);
  const width = textWidth(font, text, options.heightMm);
  const shift = options.align === "centre" ? -width / 2 : 0;
  const shapes: Pt[][][] = [];
  const missing: string[] = [];
  let pen = 0;
  for (const char of text) {
    const glyph = font.glyphFor(char);
    if (glyph === null) missing.push(char);
    const use = glyph ?? font.notdef;
    // A letter the font lacks is drawn as nothing, so a stand-in shape is never printed as if it were the letter.
    if (glyph !== null && use.rings.length > 0) shapes.push(use.rings.map((ring) => ring.map(([x, y]): Pt => [(x + pen) * k + shift, y * k])));
    pen += use.advance;
  }
  return { shapes, width, missing };
}
