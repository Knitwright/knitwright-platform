/**
 * The DPI check of F-S9's Sportswear tab: a crest or sponsor logo big enough in pixels for the size
 * it will be printed at. Vector is preferred, and a vector never warns.
 *
 * NO INVENTED MEASUREMENT. The rulebook gives the resolution (`R-SUB-003`: 150 DPI at 1:1) but no
 * sponsor or crest print width, so this never assumes one. A brand that has typed the width it wants
 * gets a real check against its own number. A brand that has not is told the largest width at which
 * the picture still meets 150 DPI, and that the width is still its to set.
 */

import { effectiveDpi, largestWidthMm } from "@/lib/artwork-intake/dpi";
import { DEFAULT_MIN_DPI } from "@/lib/artwork-intake/settings";
import type { ArtworkFacts, BrandAsset } from "./types";
import { ASSET_KIND_LABELS, RULES, type BrandFinding } from "./words";

/**
 * The minimum the checks run against, and where the number came from. The same value and the same
 * words as `lib/guardrails/settings.ts`, taken from the module without the schema library behind it
 * so the Sportswear panel can run this check in the browser (tests/architecture/client-weight).
 */
export const MIN_DPI = { value: DEFAULT_MIN_DPI, source: "knitwright-default" } as const;

const sourceNote = (source: "print-house" | "knitwright-default"): string =>
  source === "print-house" ? "from your print house" : "Knitwright default, not from your print house";

/** The kinds F-S9 puts the DPI check on: what a factory prints at a stated size. */
export const CHECKED_KINDS = ["crest", "sponsor", "label"] as const;

const round = (value: number): number => Math.round(value);

/** A picture asset paired with the facts its upload recorded, or null when the upload is gone. */
export interface CheckedAsset {
  readonly asset: BrandAsset;
  readonly artwork: ArtworkFacts | null;
}

const subjectOf = (entry: CheckedAsset): string =>
  entry.asset.sponsorName ?? (entry.asset.label.trim() === "" ? ASSET_KIND_LABELS[entry.asset.kind] : entry.asset.label);

/** "Use a vector where you can", the best practice R-SUB-003 carries. A note, never a warning. */
const vectorNote = (subject: string): BrandFinding => ({
  code: "sponsor-raster",
  severity: "note",
  ruleId: RULES.printResolution,
  subject,
  message: `${subject} is a picture made of pixels, not a drawing.`,
  fix: "Upload the SVG or PDF your sponsor supplied where you can; a drawing stays sharp at any size.",
});

/** The real check: the pixels over the width the brand asked for, against the minimum. */
const dpiFinding = (entry: CheckedAsset, artwork: ArtworkFacts, widthMm: number): BrandFinding | null => {
  const subject = subjectOf(entry);
  const dpi = effectiveDpi({ widthPx: artwork.widthPx }, widthMm);
  if (dpi >= MIN_DPI.value) return null;
  return {
    code: "sponsor-dpi",
    severity: "warning",
    ruleId: RULES.printResolution,
    subject,
    message: `${subject} would print at about ${round(dpi)} dpi at ${round(widthMm)} mm wide, under the ${MIN_DPI.value} dpi minimum (${sourceNote(MIN_DPI.source)}), so it may look soft.`,
    fix: `Ask for a larger file or a vector, or print it no wider than about ${round(largestWidthMm({ widthPx: artwork.widthPx }, MIN_DPI.value))} mm.`,
  };
};

/** Said when no print width has been typed: the pixels are known, the size is not. */
const noWidthFinding = (entry: CheckedAsset, artwork: ArtworkFacts): BrandFinding => {
  const subject = subjectOf(entry);
  return {
    code: "sponsor-dpi",
    severity: "note",
    ruleId: RULES.printResolution,
    subject,
    message: `${subject} is ${artwork.widthPx} by ${artwork.heightPx} pixels. At ${MIN_DPI.value} dpi it stays sharp up to about ${round(largestWidthMm({ widthPx: artwork.widthPx }, MIN_DPI.value))} mm wide. How wide it will be printed is still yours to set.`,
    fix: "Type the width you want it printed at, and this will say whether the file is big enough.",
  };
};

/** Every finding about one crest, sponsor logo or label picture. A drawing warns about nothing. */
export function assetFindings(entry: CheckedAsset): readonly BrandFinding[] {
  if (!CHECKED_KINDS.some((kind) => kind === entry.asset.kind)) return [];
  const { artwork } = entry;
  const printWidthMm = entry.asset.printWidthMm;
  if (artwork === null) return [];
  if (artwork.kind === "vector") return [];
  const width = printWidthMm !== null && printWidthMm > 0 ? printWidthMm : null;
  const dpi = width === null ? noWidthFinding(entry, artwork) : dpiFinding(entry, artwork, width);
  return [vectorNote(subjectOf(entry)), ...(dpi === null ? [] : [dpi])];
}

/** Every finding about every checked picture, in the order the pictures are shown. */
export const allAssetFindings = (entries: readonly CheckedAsset[]): readonly BrandFinding[] =>
  entries.flatMap((entry) => assetFindings(entry));
