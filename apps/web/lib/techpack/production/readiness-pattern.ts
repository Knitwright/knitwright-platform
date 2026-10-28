import type { GradedPattern, PatternPiece, ReadinessItem } from "@/lib/production/contract";
import { listOf } from "../text";
import type { ProductionInput } from "./input";
import { patternSizeOf } from "./measured";

/** Two joined edges agree when they differ by no more than this, or by the ease the pattern states. */
const SEAM_TOLERANCE_MM = 2;

type Item = ReadinessItem;

const item = (id: string, whoActs: Item["whoActs"], met: boolean, whenMet: string, whenOpen: string): Item => ({
  id,
  whoActs,
  met,
  sentence: met ? whenMet : whenOpen,
});

const piecesOf = (pattern: GradedPattern): PatternPiece[] => pattern.sizes.flatMap((size) => pattern.piecesBySize[size] ?? []);

const named = (pieces: readonly PatternPiece[]): string => listOf([...new Set(pieces.map((piece) => piece.name))]);

/** A hem is finished, not joined to another piece, even where front and back both have one. */
const FINISHED_EDGE = /(^|-)hem$/;

/** Seams that two or more pieces share, so they are sewn together. A hem is not one. */
function joinedSeams(pieces: readonly PatternPiece[]): string[] {
  const owners = new Map<string, Set<string>>();
  for (const piece of pieces) {
    for (const edge of piece.seamAllowance) owners.set(edge.seamId, (owners.get(edge.seamId) ?? new Set()).add(piece.id));
  }
  return [...owners].filter(([seamId, ids]) => ids.size >= 2 && !FINISHED_EDGE.test(seamId)).map(([seamId]) => seamId);
}

function allowanceItem(pieces: readonly PatternPiece[]): Item {
  const lacking = pieces.filter(
    (piece) => piece.outlineKind === "unknown" || piece.seamAllowance.length === 0 || piece.seamAllowance.some((edge) => edge.source === "not-stated"),
  );
  return item(
    "pattern-seam-allowance",
    "technician",
    pieces.length > 0 && lacking.length === 0,
    "Every edge of every piece states its seam allowance.",
    pieces.length === 0 ? "A technician adds the pattern, with the seam allowance on every edge." : `A technician states the seam allowance on every edge and says whether the outline includes it (missing on ${named(lacking)}).`,
  );
}

function notchItem(pieces: readonly PatternPiece[]): Item {
  const joined = joinedSeams(pieces);
  const lacking = pieces.filter((piece) =>
    joined.some((seamId) => piece.seamAllowance.some((edge) => edge.seamId === seamId) && !piece.notches.some((notch) => notch.seamId === seamId)),
  );
  return item(
    "pattern-notches",
    "technician",
    pieces.length > 0 && lacking.length === 0,
    "Every joined seam has its notches.",
    pieces.length === 0 ? "A technician adds the pattern, with notches on every joined seam." : `A technician adds notches to every joined seam (missing on ${named(lacking)}).`,
  );
}

const agrees = (a: NonNullable<ProductionInput["seamAgreements"]>[number]): boolean => {
  const difference = Math.abs(a.differenceMm);
  return difference <= SEAM_TOLERANCE_MM || (a.statedEaseMm !== null && Math.abs(difference - a.statedEaseMm) <= SEAM_TOLERANCE_MM);
};

function seamsItem(agreements: ProductionInput["seamAgreements"]): Item {
  const list = agreements ?? [];
  const off = list.filter((a) => !agrees(a));
  const open =
    list.length === 0
      ? "A technician compares the lengths of the joined seams. None has been compared yet."
      : `A technician fixes the seams that differ by more than ${SEAM_TOLERANCE_MM} mm: ${listOf([...new Set(off.map((a) => `${a.label} at size ${a.size}`))])}.`;
  return item("pattern-seams-agree", "technician", list.length > 0 && off.length === 0, `Joined seams agree within ${SEAM_TOLERANCE_MM} mm or the ease the pattern states.`, open);
}

/** Item 1 of the definition: the pattern, for every ordered size, from a reviewed block version. */
export function patternItems(input: ProductionInput, orderedSizes: readonly string[]): Item[] {
  const pattern = input.pattern ?? null;
  const map = input.sizeMap ?? [];
  const wanted = orderedSizes.map((label) => patternSizeOf(label, map));
  const missingSizes = pattern === null ? wanted : wanted.filter((size) => !pattern.sizes.includes(size));
  const present = pattern !== null && missingSizes.length === 0 && wanted.length > 0;
  const pieces = pattern ? piecesOf(pattern) : [];
  const review = input.review ?? null;
  const reviewed = pattern !== null && review !== null && review.blockVersion === pattern.blockVersion;
  const grainLacking = pieces.filter((piece) => piece.grainLine === null);
  return [
    item(
      "pattern-present",
      "technician",
      present,
      "Every ordered size has a pattern.",
      pattern === null
        ? "A technician adds a pattern: a draft or your own DXF file."
        : wanted.length === 0
          ? "Set the sizes of the design so each can be matched to a pattern size."
          : `A technician adds the pattern for size ${listOf(missingSizes)}.`,
    ),
    item(
      "pattern-review",
      "technician",
      reviewed,
      `Reviewed by ${review?.name ?? ""} on ${review?.date ?? ""}.`,
      "Draft pattern, not reviewed. A technician reviews this version of the pattern and records their name and date.",
    ),
    allowanceItem(pieces),
    notchItem(pieces),
    seamsItem(input.seamAgreements),
    item(
      "pattern-grain",
      "technician",
      pieces.length > 0 && grainLacking.length === 0,
      "Every piece has a grain line.",
      pieces.length === 0 ? "A technician adds the pieces, each with a grain line." : `A technician adds a grain line to ${named(grainLacking)}.`,
    ),
  ];
}
