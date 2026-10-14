import { DEFAULT_LABEL, type BuildEnv, type PieceRequest } from "./context";
import type { Issue } from "./scene";

export const DRAFT_PATTERN_SENTENCE = "Draft pattern, not reviewed.";
export const FROM_PICTURE_SENTENCE = "Read from a picture. Compare with the picture before printing.";

export interface NoteFacts {
  readonly env: BuildEnv;
  readonly req: PieceRequest;
  readonly pieceName: string;
  readonly lowestDpi: number | null;
  readonly dpi: number;
  readonly dpiLowered: boolean;
  readonly flattenedBy: string | null;
  readonly fromPicture: boolean;
  readonly agreement: readonly string[];
  readonly extra: readonly string[];
  readonly issues: readonly Issue[];
}

const four = (value: number): string => value.toFixed(4);

/** The sentence about the scale applied, which every file carries. */
export function scaleNote(env: Pick<BuildEnv, "scale" | "scaleSource">): string {
  const { length, width, note } = env.scale;
  const applied = `${four(length)} along the length and ${four(width)} across`;
  const source = env.scaleSource === null ? "" : ` (${env.scaleSource})`;
  if (note === null) return `Scale applied: ${applied}${source}.`;
  if (length === 1 && width === 1) return note;
  return `${note} Scale applied: ${applied}${source}.`;
}

/** What the file's margin says about colour: the profile embedded, none set, or one set that could not be read. */
function colourProfileNote(env: BuildEnv): string {
  if (env.settings.iccBytes !== null) return `Colour profile embedded: ${env.settings.iccName ?? "from your print house"}.`;
  if (env.settings.iccFileId !== null) return "The colour profile in your print settings could not be read, so colours are sRGB.";
  return "No print house colour profile set: colours are sRGB.";
}

/** Facts first, then anything unmet: the lines that go in a file's margin. */
export function marginNotes(f: NoteFacts): string[] {
  const { env, req } = f;
  const who = req.player === undefined ? "no player" : `${req.player.name === "" ? "(no name)" : req.player.name} #${req.player.number}`;
  const label = req.sizeLabel === undefined ? "" : ` (${req.sizeLabel})`;
  const source = env.settings.source === "print-house" ? "from your print house" : DEFAULT_LABEL;
  const lines = [
    `${f.pieceName} | size ${req.size}${label} | ${who}${req.transferOnly === true ? " | name and number only" : ""}`,
    scaleNote(env),
    f.lowestDpi === null ? "No pictures on this piece." : `Lowest picture resolution on this piece: about ${Math.round(f.lowestDpi)} dpi.`,
    `Bleed ${env.settings.bleedMm} mm and ${f.dpi} dpi (${source}).${f.dpiLowered ? ` Lowered from ${env.settings.dpi} dpi because the piece would have too many pixels.` : ""}`,
    colourProfileNote(env),
    ...(env.patternReviewed ? [] : [DRAFT_PATTERN_SENTENCE]),
    ...(f.fromPicture ? [FROM_PICTURE_SENTENCE] : []),
    ...(f.flattenedBy === null ? [] : [`Printed as pixels because ${f.flattenedBy}.`]),
    ...f.agreement,
    ...f.extra,
    ...f.issues.map((i) => i.text),
  ];
  return [...new Set(lines)];
}
