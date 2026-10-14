/**
 * A small reader for the outlines in a TrueType font (the glyf table), enough to turn text into paths.
 * It reads the character map (format 4 and 12), advance widths, simple and composite glyphs.
 * It reads only; a font that does not parse is refused with a plain error rather than guessed at.
 */

export interface GlyphPoint {
  readonly x: number;
  readonly y: number;
  readonly onCurve: boolean;
}

/** A closed run of points as the font stores it: on-curve points and quadratic control points. */
export type Contour = readonly GlyphPoint[];

export interface TrueTypeFont {
  readonly unitsPerEm: number;
  /** Height of a capital letter above the baseline, in font units. */
  readonly capHeight: number;
  glyphIndex(codePoint: number): number;
  advance(glyph: number): number;
  contours(glyph: number): readonly Contour[];
}

const FONT_ERROR = "This font file could not be read.";

class Reader {
  constructor(private readonly view: DataView) {}
  u8 = (at: number): number => this.view.getUint8(at);
  u16 = (at: number): number => this.view.getUint16(at);
  i16 = (at: number): number => this.view.getInt16(at);
  u32 = (at: number): number => this.view.getUint32(at);
  get length(): number {
    return this.view.byteLength;
  }
}

function tableDirectory(r: Reader): Map<string, { offset: number; length: number }> {
  if (r.length < 12) throw new Error(FONT_ERROR);
  const count = r.u16(4);
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    if (at + 16 > r.length) throw new Error(FONT_ERROR);
    const tag = String.fromCharCode(r.u8(at), r.u8(at + 1), r.u8(at + 2), r.u8(at + 3));
    tables.set(tag, { offset: r.u32(at + 8), length: r.u32(at + 12) });
  }
  return tables;
}

function cmapReader(r: Reader, base: number): (codePoint: number) => number {
  const count = r.u16(base + 2);
  let chosen = -1;
  for (let i = 0; i < count; i += 1) {
    const platform = r.u16(base + 4 + i * 8);
    const encoding = r.u16(base + 6 + i * 8);
    const offset = base + r.u32(base + 8 + i * 8);
    const format = r.u16(offset);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (unicode && (format === 12 || (format === 4 && chosen < 0))) chosen = offset;
    if (unicode && format === 12) break;
  }
  if (chosen < 0) throw new Error(FONT_ERROR);
  return r.u16(chosen) === 12 ? format12(r, chosen) : format4(r, chosen);
}

function format12(r: Reader, at: number): (codePoint: number) => number {
  const groups = r.u32(at + 12);
  return (code) => {
    for (let i = 0; i < groups; i += 1) {
      const g = at + 16 + i * 12;
      const start = r.u32(g);
      if (code >= start && code <= r.u32(g + 4)) return r.u32(g + 8) + (code - start);
    }
    return 0;
  };
}

function format4(r: Reader, at: number): (codePoint: number) => number {
  const segments = r.u16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  return (code) => {
    if (code > 0xffff) return 0;
    for (let i = 0; i < segments; i += 1) {
      if (code > r.u16(ends + i * 2)) continue;
      const start = r.u16(starts + i * 2);
      if (code < start) return 0;
      const range = r.u16(rangeOffsets + i * 2);
      if (range === 0) return (code + r.i16(deltas + i * 2)) & 0xffff;
      const glyph = r.u16(rangeOffsets + i * 2 + range + (code - start) * 2);
      return glyph === 0 ? 0 : (glyph + r.i16(deltas + i * 2)) & 0xffff;
    }
    return 0;
  };
}

interface Tables {
  readonly glyf: number;
  readonly loca: (glyph: number) => [number, number];
  readonly glyphCount: number;
}

function simpleContours(r: Reader, at: number, count: number): Contour[] {
  const ends = Array.from({ length: count }, (_, i) => r.u16(at + 10 + i * 2));
  const total = (ends[count - 1] ?? -1) + 1;
  let p = at + 10 + count * 2;
  p += 2 + r.u16(p);
  const flags: number[] = [];
  while (flags.length < total) {
    const flag = r.u8(p++);
    flags.push(flag);
    if (flag & 8) for (let n = r.u8(p++); n > 0 && flags.length < total; n -= 1) flags.push(flag);
  }
  const axis = (short: number, same: number): number[] => {
    let value = 0;
    return flags.map((flag) => {
      if (flag & short) {
        const d = r.u8(p++);
        value += flag & same ? d : -d;
      } else if (!(flag & same)) {
        value += r.i16(p);
        p += 2;
      }
      return value;
    });
  };
  const xs = axis(2, 16);
  const ys = axis(4, 32);
  let from = 0;
  return ends.map((end) => {
    const contour = flags.slice(from, end + 1).map((flag, i): GlyphPoint => ({ x: xs[from + i] as number, y: ys[from + i] as number, onCurve: (flag & 1) === 1 }));
    from = end + 1;
    return contour;
  });
}

type Loader = (glyph: number, depth: number) => Contour[];

function compositeContours(r: Reader, at: number, load: Loader, depth: number): Contour[] {
  const out: Contour[] = [];
  let p = at + 10;
  for (;;) {
    const flags = r.u16(p);
    const part = r.u16(p + 2);
    p += 4;
    let dx = 0;
    let dy = 0;
    if (flags & 1) {
      dx = flags & 2 ? r.i16(p) : 0;
      dy = flags & 2 ? r.i16(p + 2) : 0;
      p += 4;
    } else {
      dx = flags & 2 ? (r.u8(p) << 24) >> 24 : 0;
      dy = flags & 2 ? (r.u8(p + 1) << 24) >> 24 : 0;
      p += 2;
    }
    let [a, b, c, d] = [1, 0, 0, 1];
    const f2 = (o: number): number => r.i16(o) / 16384;
    if (flags & 8) {
      a = d = f2(p);
      p += 2;
    } else if (flags & 0x40) {
      a = f2(p);
      d = f2(p + 2);
      p += 4;
    } else if (flags & 0x80) {
      [a, b, c, d] = [f2(p), f2(p + 2), f2(p + 4), f2(p + 6)];
      p += 8;
    }
    for (const contour of load(part, depth + 1)) {
      out.push(contour.map((pt) => ({ x: a * pt.x + c * pt.y + dx, y: b * pt.x + d * pt.y + dy, onCurve: pt.onCurve })));
    }
    if (!(flags & 0x20)) return out;
  }
}

function glyphLoader(r: Reader, tables: Tables): Loader {
  const load: Loader = (glyph, depth) => {
    if (depth > 6 || glyph < 0 || glyph >= tables.glyphCount) return [];
    const [start, end] = tables.loca(glyph);
    if (end <= start) return [];
    const at = tables.glyf + start;
    const count = r.i16(at);
    return count >= 0 ? simpleContours(r, at, count) : compositeContours(r, at, load, depth);
  };
  return load;
}

/** Reads the font bytes. Throws a plain error when they are not a TrueType font with outlines. */
export function readTrueType(bytes: Uint8Array): TrueTypeFont {
  const r = new Reader(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  try {
    const dir = tableDirectory(r);
    const need = (tag: string): { offset: number; length: number } => {
      const table = dir.get(tag);
      if (!table) throw new Error(FONT_ERROR);
      return table;
    };
    const head = need("head").offset;
    const unitsPerEm = r.u16(head + 18);
    const longLoca = r.i16(head + 50) === 1;
    const glyphCount = r.u16(need("maxp").offset + 4);
    const loca = need("loca").offset;
    const locaAt = (glyph: number): [number, number] =>
      longLoca ? [r.u32(loca + glyph * 4), r.u32(loca + glyph * 4 + 4)] : [r.u16(loca + glyph * 2) * 2, r.u16(loca + glyph * 2 + 2) * 2];
    const load = glyphLoader(r, { glyf: need("glyf").offset, loca: locaAt, glyphCount });
    const hhea = need("hhea").offset;
    const metrics = r.u16(hhea + 34);
    const hmtx = need("hmtx").offset;
    const glyphIndex = cmapReader(r, need("cmap").offset);
    const os2 = dir.get("OS/2");
    const fromTable = os2 && os2.length >= 90 && r.u16(os2.offset) >= 2 ? r.i16(os2.offset + 88) : 0;
    const capHeight = fromTable > 0 ? fromTable : Math.max(0, ...load(glyphIndex(72), 0).flat().map((pt) => pt.y));
    if (unitsPerEm <= 0 || capHeight <= 0) throw new Error(FONT_ERROR);
    return {
      unitsPerEm,
      capHeight,
      glyphIndex,
      advance: (glyph) => r.u16(hmtx + Math.min(glyph, metrics - 1) * 4),
      contours: (glyph) => load(glyph, 0),
    };
  } catch (error) {
    if (error instanceof RangeError) throw new Error(FONT_ERROR);
    throw error;
  }
}
