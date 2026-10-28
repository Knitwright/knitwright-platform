import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pt } from "../geometry/affine";
import { round2 } from "../geometry/polygon";
import type { Ring } from "../scene";
import { readTrueType, type Contour, type GlyphPoint, type TrueTypeFont } from "./truetype";

/** The bundled font. It ships under assets/fonts (SIL Open Font License 1.1) and is read once. */
export const OUTLINE_FONT_FILE = join(process.cwd(), "assets", "fonts", "Geist-Regular.ttf");

let shared: TrueTypeFont | null = null;
export function bundledFont(): TrueTypeFont {
  shared ??= readTrueType(new Uint8Array(readFileSync(OUTLINE_FONT_FILE)));
  return shared;
}

/** Straight pieces per curve. Eight keeps a letter within 0.02 mm at 60 mm tall. */
const CURVE_STEPS = 8;

function flatten(contour: Contour): Pt[] {
  const mid = (a: GlyphPoint, b: GlyphPoint): GlyphPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, onCurve: true });
  if (contour.length < 2) return [];
  // Start on an on-curve point; when there is none, start at the middle of the first two control points.
  const firstOn = contour.findIndex((p) => p.onCurve);
  const ring: GlyphPoint[] = firstOn >= 0 ? [...contour.slice(firstOn), ...contour.slice(0, firstOn)] : [mid(contour[0] as GlyphPoint, contour[1] as GlyphPoint), ...contour.slice(1), contour[0] as GlyphPoint];
  const out: Pt[] = [[ring[0]!.x, ring[0]!.y]];
  let current = ring[0] as GlyphPoint;
  const closed = [...ring.slice(1), ring[0] as GlyphPoint];
  for (let i = 0; i < closed.length; i += 1) {
    const point = closed[i] as GlyphPoint;
    if (point.onCurve) {
      out.push([point.x, point.y]);
      current = point;
      continue;
    }
    const next = closed[i + 1];
    const end: GlyphPoint = next && !next.onCurve ? mid(point, next) : (next ?? (ring[0] as GlyphPoint));
    for (let s = 1; s <= CURVE_STEPS; s += 1) {
      const t = s / CURVE_STEPS;
      const u = 1 - t;
      out.push([u * u * current.x + 2 * u * t * point.x + t * t * end.x, u * u * current.y + 2 * u * t * point.y + t * t * end.y]);
    }
    current = end;
    if (next && next.onCurve) i += 1;
    else if (!next) break;
  }
  // The closing point repeats the first.
  return out.length > 1 && out[0]![0] === out[out.length - 1]![0] && out[0]![1] === out[out.length - 1]![1] ? out.slice(0, -1) : out;
}

interface TextOutline {
  /** All glyph outlines together, to be filled with the even-odd rule. Origin: the left end of the baseline. */
  readonly rings: readonly Ring[];
  /** Width of the whole line. */
  readonly widthMm: number;
  /** Height of a capital letter, which is the height asked for. */
  readonly heightMm: number;
  /** Characters the font has no letter for; they are left out. */
  readonly missing: readonly string[];
}

/** Characters that never print: control characters and zero-width marks. */
const SKIPPED = /[\p{C}​-‏⁠﻿]/u;

/** Text as outlines, `heightMm` tall in capital letters, starting at the origin on the baseline. */
export function outlineText(text: string, heightMm: number, font: TrueTypeFont = bundledFont()): TextOutline {
  if (!Number.isFinite(heightMm) || heightMm <= 0) throw new RangeError("Text needs a height above zero.");
  const scale = heightMm / font.capHeight;
  const rings: Ring[] = [];
  const missing: string[] = [];
  let cursor = 0;
  for (const char of text) {
    if (SKIPPED.test(char)) continue;
    const glyph = font.glyphIndex(char.codePointAt(0) as number);
    if (glyph === 0 && char !== " ") missing.push(char);
    for (const contour of font.contours(glyph)) {
      const ring = flatten(contour).map(([x, y]): Pt => [round2((cursor + x) * scale), round2(y * scale)]);
      if (ring.length >= 3) rings.push(ring);
    }
    cursor += font.advance(glyph);
  }
  return { rings, widthMm: round2(cursor * scale), heightMm, missing: [...new Set(missing)] };
}

/** The width a line of text takes at a height, without building its outlines. */
export function textWidthMm(text: string, heightMm: number, font: TrueTypeFont = bundledFont()): number {
  return outlineText(text, heightMm, font).widthMm;
}
