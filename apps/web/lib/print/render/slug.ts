import type { Shape } from "../geometry/boolean";
import type { Box, Pt } from "../geometry/vec";
import { textShapes, textWidth, type Font } from "../text/font";

/** The height of a capital in the margin text, in millimetres. Readable on a proof and small enough to fit a bleed. */
export const SLUG_HEIGHT_MM = 2.2;
const LINE_STEP_MM = 3.4;
const INSET_MM = 1.5;

export interface Slug {
  readonly shapes: readonly Shape[];
  /** The lines that fitted in the margin, in order. */
  readonly fitted: readonly string[];
  /** The lines that did not fit, which the file carries in its description instead. */
  readonly overflow: readonly string[];
}

/** Breaks a line at spaces so each piece is no wider than `maxWidth`. A word wider than that is kept whole. */
export function wrapLine(font: Font, line: string, maxWidth: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    const next = current === "" ? word : `${current} ${word}`;
    if (current !== "" && textWidth(font, next, SLUG_HEIGHT_MM) > maxWidth) {
      out.push(current);
      current = word;
    } else current = next;
  }
  if (current !== "") out.push(current);
  return out;
}

/**
 * Sets the notes as outlined text in the margin: the band of bleed above the piece first, then the band below it.
 * Text in the bleed is cut away with the bleed, so it never reaches the garment. Whatever does not fit is returned
 * as overflow, and the file carries it in its description.
 */
export function slugOf(font: Font, notes: readonly string[], page: Box, bleedMm: number): Slug {
  const room = Math.floor((bleedMm - 2 * 0.5) / LINE_STEP_MM);
  const width = page.maxX - page.minX - 2 * INSET_MM;
  const lines = notes.flatMap((note) => wrapLine(font, note, width).map((part, at) => ({ note, text: at === 0 ? part : `  ${part}` })));
  const shapes: Shape[] = [];
  const fitted = new Set<string>();
  const perBand = Math.max(0, room);
  lines.forEach((line, at) => {
    const band = Math.floor(at / Math.max(1, perBand));
    if (perBand === 0 || band > 1) return;
    const row = at % perBand;
    const baseline = band === 0 ? page.maxY - 0.5 - SLUG_HEIGHT_MM - row * LINE_STEP_MM : page.minY + 0.5 + (perBand - 1 - row) * LINE_STEP_MM + 0.3;
    const { shapes: glyphs } = textShapes(font, line.text, { heightMm: SLUG_HEIGHT_MM });
    for (const glyph of glyphs) shapes.push(glyph.map((ring) => ring.map(([x, y]): Pt => [x + page.minX + INSET_MM, y + baseline])));
    fitted.add(line.note);
  });
  const shown = notes.filter((n) => fitted.has(n) && lines.filter((l) => l.note === n).every((l) => lines.indexOf(l) < 2 * perBand));
  return { shapes, fitted: shown, overflow: notes.filter((n) => !shown.includes(n)) };
}
