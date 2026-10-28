import type { PatternMeasurement, PatternPiece } from "@/lib/production/contract";
import { checkSize, refusals, type CheckResult } from "./checks";
import { DxfSyntaxError } from "./dxf/parse";
import { readDxf } from "./dxf/read";
import { withOverrides, type Landmarks } from "./landmarks";
import { measurePattern, type Skip } from "./measure";
import { addNotches } from "./notches";
import { withSeamAllowance, type AllowanceChoice, type OutlineAnswer } from "./seam-allowance";
import { orderSizes } from "./sizes";

/**
 * Takes the DXF files of a size set (one file per size, or one file holding every size) and
 * makes the library's pieces: reads them, adds the seam allowance a net outline needs and the
 * notches a file lacks, runs every check, and measures every size. A set whose front and back
 * do not sew together is refused with the seam named.
 */

export const MAX_SIZES = 30;

type SetFile = Readonly<{ name: string; text: string }>;

type SetInput = Readonly<{
  files: readonly SetFile[];
  /** What the outline is, when the files do not say. Left out, the library asks. */
  outline?: OutlineAnswer | null;
  /** Landmarks placed by hand, by "size/piece id". */
  overrides?: Readonly<Record<string, Landmarks>>;
  sizeOrder?: readonly string[];
  allowance?: AllowanceChoice;
}>;

export type PatternSet = Readonly<{
  ok: true;
  sizes: readonly string[];
  piecesBySize: Readonly<Record<string, readonly PatternPiece[]>>;
  measurementsBySize: Readonly<Record<string, readonly PatternMeasurement[]>>;
  skippedBySize: Readonly<Record<string, readonly Skip[]>>;
  checks: readonly CheckResult[];
  warnings: readonly string[];
  /** What the library added to the files, one sentence each. */
  derived: readonly string[];
  /** Questions a person must answer before the pattern can be treated as complete. */
  questions: readonly string[];
}>;

export type Refused = Readonly<{ ok: false; reasons: readonly string[] }>;

const refuse = (...reasons: string[]): Refused => ({ ok: false, reasons });

function readFiles(files: readonly SetFile[]): { pieces: PatternPiece[]; warnings: string[] } | Refused {
  const pieces: PatternPiece[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    try {
      const read = readDxf(file.text);
      pieces.push(...read.pieces);
      warnings.push(...read.warnings.map((w) => (files.length > 1 ? `${file.name}: ${w}` : w)));
    } catch (error) {
      if (error instanceof DxfSyntaxError || error instanceof Error) return refuse(`${file.name}: ${error.message}`);
      throw error;
    }
  }
  return { pieces, warnings };
}

function groupBySize(pieces: readonly PatternPiece[], preferred?: readonly string[]): { sizes: string[]; bySize: Map<string, PatternPiece[]> } {
  const sizes = orderSizes(pieces.map((p) => p.sizeLabel), preferred);
  return { sizes, bySize: new Map(sizes.map((size) => [size, pieces.filter((p) => p.sizeLabel === size)])) };
}

function sizeProblems(sizes: readonly string[], bySize: ReadonlyMap<string, readonly PatternPiece[]>): string[] {
  const problems: string[] = [];
  const reference = new Set((bySize.get(sizes[0]) ?? []).map((p) => p.id));
  for (const size of sizes) {
    const list = bySize.get(size) ?? [];
    const ids = list.map((p) => p.id);
    if (new Set(ids).size !== ids.length) problems.push(`Size ${size} is in the files more than once, so its pieces cannot be told apart.`);
    const missing = [...reference].filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !reference.has(id));
    if (missing.length > 0) problems.push(`Size ${size} has no ${missing.join(", ")}, which size ${sizes[0]} has.`);
    if (extra.length > 0) problems.push(`Size ${size} has ${extra.join(", ")}, which size ${sizes[0]} does not have.`);
  }
  return problems;
}

/** Applies the person's answers and the library's additions to the pieces of one size. */
function completeSize(size: string, pieces: readonly PatternPiece[], input: SetInput, derived: Set<string>, questions: Set<string>): PatternPiece[] {
  const handled = pieces.map((piece) => {
    const placed = input.overrides?.[`${size}/${piece.id}`];
    const own = placed ? { ...piece, landmarks: withOverrides(piece.landmarks, placed) } : piece;
    const result = withSeamAllowance(own, input.outline ?? null, input.allowance);
    if (!result.ok) {
      questions.add(result.question);
      return own;
    }
    if (result.derived) derived.add(result.derived);
    return result.piece;
  });
  const notched = addNotches(handled);
  for (const sentence of notched.derived) derived.add(sentence);
  return [...notched.pieces];
}

/** Reads, completes, checks and measures a size set. */
export function buildSet(input: SetInput): PatternSet | Refused {
  if (input.files.length === 0) return refuse("No pattern file was given.");
  const read = readFiles(input.files);
  if ("ok" in read) return read;
  if (read.pieces.length === 0) return refuse("No pieces were found in the files.", ...read.warnings);
  const { sizes, bySize } = groupBySize(read.pieces, input.sizeOrder);
  if (sizes.length > MAX_SIZES) return refuse(`The files hold ${sizes.length} sizes; the most a set can hold is ${MAX_SIZES}.`);
  const problems = sizeProblems(sizes, bySize);
  if (problems.length > 0) return refuse(...problems);

  const derived = new Set<string>();
  const questions = new Set<string>();
  const piecesBySize: Record<string, readonly PatternPiece[]> = {};
  for (const size of sizes) piecesBySize[size] = completeSize(size, bySize.get(size) ?? [], input, derived, questions);

  const checks = sizes.flatMap((size) => checkSize(size, piecesBySize[size]));
  const stopped = refusals(checks);
  if (stopped.length > 0) return refuse(...stopped.map((r) => r.sentence));

  const measured = Object.fromEntries(sizes.map((size) => [size, measurePattern(size, piecesBySize[size])]));
  return {
    ok: true,
    sizes,
    piecesBySize,
    measurementsBySize: Object.fromEntries(sizes.map((size) => [size, measured[size].measurements])),
    skippedBySize: Object.fromEntries(sizes.map((size) => [size, measured[size].skipped])),
    checks,
    warnings: read.warnings,
    derived: [...derived],
    questions: [...questions],
  };
}
