import type { Box, FillItem, PrintIssue } from "../scene";
import { round2 } from "../geometry/polygon";
import { outlineText } from "../text/outline";

/** Taller than this and the note would not fit the bleed. */
const LINE_MM = 2.6;
const MIN_BLEED_FOR_NOTE_MM = 6;

interface NoteInput {
  readonly pieceName: string;
  readonly size: string;
  readonly player: string | null;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly scaleNote: string | null;
  readonly defaultsNote: string | null;
  readonly lowestDpi: number | null;
  readonly patternReviewed: boolean;
  readonly patternNote?: string | null;
  readonly readFromPicture: boolean;
  readonly rasterReason: string | null;
  readonly issues: readonly PrintIssue[];
  readonly playerNote: string | null;
}

/** The lines written in the margin of a file and into its description. */
export function noteLines(n: NoteInput): string[] {
  const lines = [`${n.pieceName}, size ${n.size}${n.player ? `, ${n.player}` : ""}. Printed 1:1.`];
  lines.push(n.scaleNote ?? `Scaled ${n.scaleX.toFixed(4)} x ${n.scaleY.toFixed(4)} for shrink (length x width).`);
  if (n.lowestDpi !== null) lines.push(`Lowest picture on this piece: ${Math.round(n.lowestDpi)} dpi.`);
  if (n.patternNote) lines.push(n.patternNote);
  else if (!n.patternReviewed) lines.push("Draft pattern, not reviewed.");
  if (n.defaultsNote) lines.push(n.defaultsNote);
  if (n.readFromPicture) lines.push("Read from a picture. Compare with the picture before printing.");
  if (n.rasterReason) lines.push(n.rasterReason);
  if (n.playerNote) lines.push(n.playerNote);
  for (const issue of n.issues) if (issue.severity !== "note") lines.push(`${issue.severity === "stop" ? "Do not print: " : "Check: "}${issue.text}`);
  return lines;
}

const WHITE = "#ffffff";
const INK = "#000000";

/**
 * The note as outlines in the top bleed, over a white strip. Lines too long for the page are cut with three dots.
 * Nothing is drawn when the bleed is too thin to hold it; the lines are still in the file's description.
 */
export function marginItems(lines: readonly string[], cutBox: Box, bleedMm: number): FillItem[] {
  if (bleedMm < MIN_BLEED_FOR_NOTE_MM || lines.length === 0) return [];
  const pitch = Math.min(LINE_MM * 1.25, (bleedMm - 1) / lines.length);
  const height = pitch / 1.25;
  const pageWidth = cutBox.maxX - cutBox.minX + 2 * bleedMm - 2;
  const left = cutBox.minX - bleedMm + 1;
  const top = cutBox.maxY + bleedMm;
  const shown = lines.slice(0, Math.floor((bleedMm - 1) / pitch));
  const strip: FillItem = {
    kind: "fill",
    layerId: "margin",
    rings: [[[left - 0.5, top - 0.5], [left + pageWidth + 0.5, top - 0.5], [left + pageWidth + 0.5, top - 0.5 - pitch * shown.length - 0.5], [left - 0.5, top - 0.5 - pitch * shown.length - 0.5]]],
    colour: WHITE,
    opacity: 1,
    blend: "normal",
  };
  const glyphs = shown.flatMap((line, at): FillItem[] => {
    let text = line;
    while (text.length > 4 && outlineText(text, height).widthMm > pageWidth) text = `${text.slice(0, Math.max(1, text.length - 6))}...`;
    const out = outlineText(text, height);
    const baseline = top - 0.5 - pitch * (at + 1) + (pitch - height) / 2;
    return [{ kind: "fill", layerId: "margin", rings: out.rings.map((ring) => ring.map(([x, y]) => [round2(left + x), round2(baseline + y)] as const)), colour: INK, opacity: 1, blend: "normal" }];
  });
  return [strip, ...glyphs];
}
