import { readFileSync } from "node:fs";
import { PDF_FONT_FILE } from "@/lib/flat/pdf-font";

/**
 * Text that a person typed may hold any character. The PDF font does not have them all, and
 * the PDF library draws a character it lacks as the wrong glyph and can garble the letters
 * after it. So every string that goes into the PDF is first made of characters the font has.
 * A character it lacks is shown as a question mark, and the document says so.
 */

const SFNT_HEADER = 12;
const TABLE_RECORD = 16;
const REPLACEMENT = "?";

/** The code points that a font file draws, read from its character map (formats 4 and 12). */
export function coveredCodePoints(font: Uint8Array): ReadonlySet<number> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const tables = view.getUint16(4);
  let cmap = -1;
  for (let index = 0; index < tables; index += 1) {
    const at = SFNT_HEADER + index * TABLE_RECORD;
    if (String.fromCharCode(...font.subarray(at, at + 4)) === "cmap") cmap = view.getUint32(at + 8);
  }
  if (cmap < 0) throw new RangeError("The font has no character map.");
  const covered = new Set<number>();
  const subtables = view.getUint16(cmap + 2);
  for (let index = 0; index < subtables; index += 1) {
    const start = cmap + view.getUint32(cmap + 4 + index * 8 + 4);
    const format = view.getUint16(start);
    if (format === 4) readFormat4(view, start, covered);
    else if (format === 12) readFormat12(view, start, covered);
  }
  if (covered.size === 0) throw new RangeError("The font's character map holds no characters.");
  return covered;
}

function readFormat4(view: DataView, start: number, covered: Set<number>): void {
  const segments = view.getUint16(start + 6) / 2;
  const ends = start + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const offsets = deltas + segments * 2;
  for (let segment = 0; segment < segments; segment += 1) {
    const last = view.getUint16(ends + segment * 2);
    const first = view.getUint16(starts + segment * 2);
    const delta = view.getUint16(deltas + segment * 2);
    const offset = view.getUint16(offsets + segment * 2);
    for (let code = first; code <= last && code < 0xffff; code += 1) {
      const glyph =
        offset === 0
          ? (code + delta) & 0xffff
          : view.getUint16(offsets + segment * 2 + offset + (code - first) * 2);
      if (glyph !== 0) covered.add(code);
    }
  }
}

function readFormat12(view: DataView, start: number, covered: Set<number>): void {
  const groups = view.getUint32(start + 12);
  for (let group = 0; group < groups; group += 1) {
    const at = start + 16 + group * 12;
    const first = view.getUint32(at);
    const last = view.getUint32(at + 4);
    for (let code = first; code <= last && code <= 0x10ffff; code += 1) covered.add(code);
  }
}

let cached: ReadonlySet<number> | undefined;

const covered = (): ReadonlySet<number> => (cached ??= coveredCodePoints(readFileSync(PDF_FONT_FILE)));

/** True when the PDF font draws this code point. */
export const canDraw = (codePoint: number): boolean => covered().has(codePoint);

const LINE_BREAKS = new RegExp(`[\t\n\r\v\f\x85${String.fromCharCode(0x2028, 0x2029)}]+`, "g");
/** Controls, and marks with no shape, such as a zero width space or a change of direction. */
const INVISIBLE = /^[\p{Cc}\p{Cf}]$/u;

interface Converted {
  readonly text: string;
  readonly replaced: number;
}

function convert(text: string): Converted {
  let replaced = 0;
  const kept: string[] = [];
  for (const character of text.normalize("NFC").replace(LINE_BREAKS, " ")) {
    if (INVISIBLE.test(character)) continue;
    if (canDraw(character.codePointAt(0) as number)) kept.push(character);
    else {
      kept.push(REPLACEMENT);
      replaced += 1;
    }
  }
  return { text: kept.join(""), replaced };
}

/** The text with every character the font lacks shown as a question mark. It never throws. */
export const drawable = (text: string): string => convert(text).text;

/** True when the text holds a character that will be shown as a question mark. */
export const hasUndrawable = (text: string): boolean => convert(text).replaced > 0;
