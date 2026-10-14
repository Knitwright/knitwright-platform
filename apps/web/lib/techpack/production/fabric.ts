import { printScale, type FabricProfile, type FabricValue } from "@/lib/production/contract";
import { TBC, type NumberValue } from "../cell";
import { SECTION_TITLES } from "../types";
import type { Provenance } from "@/lib/garment";
import type { FabricRow, FabricSection } from "./types";

const PERCENT = ["percent", "%"] as const;

const SOURCE_NOTES: Readonly<Record<FabricValue["source"], string>> = {
  "fabric-test": "From a fabric test",
  "supplier-sheet": "From the supplier's sheet",
  suggested: "Suggested, not tested",
  "not-set": "Not set",
};

const PROVENANCE: Readonly<Record<Exclude<FabricValue["source"], "not-set">, Provenance>> = {
  "fabric-test": "brand-supplied",
  "supplier-sheet": "brand-supplied",
  suggested: "suggested-chart",
};

function measureOf(v: FabricValue, unit: string, short: string): NumberValue {
  if (v.value === null || v.source === "not-set") return TBC;
  return { status: "set", value: `${v.value} ${short}`, provenance: PROVENANCE[v.source], number: v.value, unit };
}

const sourceNote = (v: FabricValue): string =>
  v.source === "fabric-test" && v.testId !== undefined ? `From fabric test ${v.testId}` : SOURCE_NOTES[v.source];

const ROWS: readonly (readonly [id: string, label: string, pick: (f: FabricProfile) => FabricValue, unit: readonly [string, string]])[] = [
  ["stretch-length", "Stretch, along the length", (f) => f.stretchLengthPct, PERCENT],
  ["stretch-width", "Stretch, across the width", (f) => f.stretchWidthPct, PERCENT],
  ["recovery", "Recovery after stretching", (f) => f.recoveryPct, PERCENT],
  ["shrink-length", "Shrink in the press, along the length", (f) => f.shrinkLengthPct, PERCENT],
  ["shrink-width", "Shrink in the press, across the width", (f) => f.shrinkWidthPct, PERCENT],
  ["gsm", "Weight", (f) => f.gsm, ["grams per square metre", "gsm"]],
  ["usable-width", "Usable width between the edges", (f) => f.usableWidthMm, ["millimetres", "mm"]],
];

const NO_FABRIC =
  "No fabric has been tested yet. Stretch and shrink come from a fabric test the mill or print house gives you.";

const scaleCell = (scale: number): NumberValue => ({
  status: "set",
  value: scale.toFixed(4),
  provenance: "derived",
  number: Math.round(scale * 10_000) / 10_000,
  unit: "times",
});

function reductionNote(fabric: FabricProfile | null | undefined, reduction: { lengthPct: number; widthPct: number } | null | undefined): string {
  if (!reduction) return "The pattern does not say how much it was reduced for stretch.";
  const stretch =
    fabric?.stretchLengthPct.value !== null && fabric?.stretchLengthPct.value !== undefined && fabric.stretchWidthPct.value !== null
      ? ` The fabric test gives a stretch of ${fabric.stretchLengthPct.value} % along the length and ${fabric.stretchWidthPct.value} % across.`
      : " There is no fabric test to compare it with.";
  return `The pattern was reduced by ${reduction.lengthPct} % along the length and ${reduction.widthPct} % across.${stretch}`;
}

/**
 * Stretch, shrink, weight and width of the base fabric, each with where it came from. A suggested
 * or empty value never scales artwork: the print scale is worked out from a fabric test or a
 * supplier's sheet only, and otherwise says it is not scaled.
 */
export function buildFabric(
  fabric: FabricProfile | null | undefined,
  reduction: { lengthPct: number; widthPct: number } | null | undefined,
): FabricSection {
  const rows: readonly FabricRow[] = ROWS.map(([id, label, pick, [unit, short]]) => {
    const v = fabric ? pick(fabric) : { value: null, source: "not-set" as const };
    return { id, label, measure: measureOf(v, unit, short), sourceNote: sourceNote(v) };
  });
  const scale = fabric ? printScale(fabric) : null;
  return {
    id: "fabric",
    title: SECTION_TITLES.fabric,
    note: fabric ? null : NO_FABRIC,
    rows,
    printScaleLength: scale && !scale.notScaled ? scaleCell(scale.length) : TBC,
    printScaleWidth: scale && !scale.notScaled ? scaleCell(scale.width) : TBC,
    printScaleNote:
      scale && !scale.notScaled
        ? "Artwork is printed this much larger so the fabric shrinks back to size in the press."
        : "Not scaled for shrink: this fabric has no shrink test.",
    reductionNote: reductionNote(fabric, reduction),
  };
}
