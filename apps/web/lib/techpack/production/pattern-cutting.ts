import { formatCm } from "@/lib/garment";
import type { FabricProfile, GradedPattern, PatternPiece } from "@/lib/production/contract";
import { TBC, type Cell, type LengthValue, type NumberValue } from "../cell";
import { listOf } from "../text";
import type { PatternAndCuttingSection } from "./types";
import { SECTION_TITLES } from "../types";
import { cutArea, MM2_PER_CM2 } from "./geometry";
import type { MarkerSetting, PatternReview } from "./input";

export const DRAFT_PATTERN = "Draft pattern, not reviewed.";
export const NO_PATTERN = "No pattern yet. A technician's draft or your own DXF file is needed.";
export const DEFAULT_MARKER_EFFICIENCY_PCT = 80;
export const DEFAULT_MARKER_LABEL = "Knitwright default, not from your factory";

const set = (value: string, provenance: "measured-from-pattern" | "derived" | "user-edited"): Cell => ({ status: "set", value, provenance });

const number = (n: number, unit: string, short: string, provenance: "measured-from-pattern" | "derived"): NumberValue => ({
  status: "set",
  value: `${n} ${short}`,
  provenance,
  number: n,
  unit,
});

const cutWords = (piece: PatternPiece): string => {
  if (piece.onFold) return `Cut ${piece.quantity} on the fold`;
  return piece.mirroredPair ? `Cut ${piece.quantity}, a left and a right` : `Cut ${piece.quantity}`;
};

const notchWords = (piece: PatternPiece): string => {
  if (piece.notches.length === 0) return "No notches in the pattern";
  const seams = [...new Set(piece.notches.map((notch) => notch.seamId))];
  const count = piece.notches.reduce((sum, notch) => sum + notch.count, 0);
  return `${count} ${count === 1 ? "notch" : "notches"} on ${listOf(seams)}`;
};

const OUTLINE_WORDS: Readonly<Record<PatternPiece["outlineKind"], string | null>> = {
  "with-seam-allowance": "The outline includes the seam allowance",
  "without-seam-allowance": "The outline is the sewing line, without seam allowance",
  unknown: null,
};

function grainOf(piece: PatternPiece): Cell {
  if (piece.grainLine === null) return TBC;
  const { from, to } = piece.grainLine;
  return set(`Grain line drawn, ${formatCm(Math.round(Math.hypot(from[0] - to[0], from[1] - to[1]) * 10))} cm long`, "measured-from-pattern");
}

const roundCm2 = (mm2: number): number => Math.round(mm2 / MM2_PER_CM2);

function cutRow(size: string, piece: PatternPiece) {
  const outline = OUTLINE_WORDS[piece.outlineKind];
  return {
    size,
    pieceId: piece.id,
    name: set(piece.name, "measured-from-pattern"),
    quantity: number(piece.quantity, "pieces", piece.quantity === 1 ? "piece" : "pieces", "measured-from-pattern"),
    cut: set(cutWords(piece), "measured-from-pattern"),
    grain: grainOf(piece),
    outline: outline === null ? TBC : set(outline, "measured-from-pattern"),
    notches: set(notchWords(piece), "measured-from-pattern"),
    area: number(roundCm2(cutArea(piece)), "square centimetres", "cm²", "measured-from-pattern"),
  };
}

const ALLOWANCE_SOURCES = {
  "pattern-file": "From the pattern file",
  "knitwright-default": "Knitwright default, not from your pattern file",
  "not-stated": "The pattern file does not state it",
} as const;

function allowanceRows(pattern: GradedPattern) {
  return pattern.sizes.flatMap((size) =>
    (pattern.piecesBySize[size] ?? []).flatMap((piece) =>
      piece.seamAllowance.map((entry) => {
        const tenthsMm = entry.mm === null ? 0 : Math.round(entry.mm * 10);
        const allowance: LengthValue =
          entry.mm === null
            ? TBC
            : { status: "set", value: formatCm(tenthsMm), tenthsMm, provenance: entry.source === "pattern-file" ? "measured-from-pattern" : "derived" };
        return { size, pieceName: piece.name, seamId: entry.seamId, allowance, sourceNote: ALLOWANCE_SOURCES[entry.source] };
      }),
    ),
  );
}

interface Marker {
  readonly efficiencyPct: number;
  readonly label: string;
}

const markerOf = (marker: MarkerSetting | null | undefined): Marker =>
  marker
    ? { efficiencyPct: marker.efficiencyPct, label: marker.source === "knitwright-default" ? DEFAULT_MARKER_LABEL : marker.source === "marker" ? "from the factory's marker" : "from your factory" }
    : { efficiencyPct: DEFAULT_MARKER_EFFICIENCY_PCT, label: DEFAULT_MARKER_LABEL };

/** The length of fabric, in metres to the nearest centimetre, that pieces of this area need at this width and efficiency. */
const toMetres = (areaMm2: number, widthMm: number, efficiencyPct: number): number =>
  Math.round(areaMm2 / (widthMm * (efficiencyPct / 100)) / 10) / 100;

function fabricUse(pattern: GradedPattern, fabric: FabricProfile | null | undefined, marker: Marker) {
  const width = fabric?.usableWidthMm;
  const usable = width !== undefined && width.value !== null && width.source !== "not-set" && width.value > 0;
  const rows = pattern.sizes.map((size) => {
    const area = (pattern.piecesBySize[size] ?? []).reduce((sum, piece) => sum + cutArea(piece), 0);
    const areaCell = number(roundCm2(area), "square centimetres", "cm²", "measured-from-pattern");
    const length: NumberValue =
      usable && width.value !== null
        ? number(toMetres(area, width.value, marker.efficiencyPct), "metres", "m", "derived")
        : TBC;
    return {
      size,
      area: areaCell,
      length,
      note: usable ? `Pieces fitted at ${marker.efficiencyPct} % efficiency (${marker.label}).` : "Needs the usable fabric width.",
    };
  });
  const note = usable
    ? `Fabric use is the area of every piece cut, divided by the usable width and a marker efficiency of ${marker.efficiencyPct} % (${marker.label}). It is a number for planning, not a marker.`
    : "Fabric use needs the usable width of the fabric from a supplier's sheet or a fabric test. Until then only the area of the pieces is given.";
  return { rows, note };
}

function reviewCell(review: PatternReview | null | undefined): Cell {
  return review ? set(`Reviewed by ${review.name} on ${review.date}`, "user-edited") : set(DRAFT_PATTERN, "derived");
}

export interface PatternCuttingInput {
  readonly pattern: GradedPattern | null | undefined;
  readonly review: PatternReview | null | undefined;
  readonly fabric: FabricProfile | null | undefined;
  readonly marker: MarkerSetting | null | undefined;
}

/**
 * The pieces of the pattern, how each is cut, the seam allowance on each edge, the notches the
 * pattern really has, and the fabric the pieces use. Everything is read from the pattern itself.
 * A pattern file that does not say a thing leaves it to be confirmed; nothing is filled in.
 */
export function buildPatternAndCutting(input: PatternCuttingInput): PatternAndCuttingSection {
  const { pattern } = input;
  const reviewStatus = reviewCell(input.review);
  if (!pattern) {
    return {
      id: "pattern-and-cutting",
      title: SECTION_TITLES["pattern-and-cutting"],
      note: NO_PATTERN,
      reviewStatus,
      blockName: null,
      cutList: [],
      seamAllowances: [],
      fabricUse: [],
      fabricUseNote: "",
    };
  }
  const use = fabricUse(pattern, input.fabric, markerOf(input.marker));
  return {
    id: "pattern-and-cutting",
    title: SECTION_TITLES["pattern-and-cutting"],
    note: input.review ? null : DRAFT_PATTERN,
    reviewStatus,
    blockName: `${pattern.blockId}, version ${pattern.blockVersion}`,
    cutList: pattern.sizes.flatMap((size) => (pattern.piecesBySize[size] ?? []).map((piece) => cutRow(size, piece))),
    seamAllowances: allowanceRows(pattern),
    fabricUse: use.rows,
    fabricUseNote: use.note,
  };
}
