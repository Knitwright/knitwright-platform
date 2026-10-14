import { printScale as contractPrintScale, type FabricProfile, type PrintScale } from "@/lib/production/contract";

/** The print scale for a fabric, as the contract works it out: only a test or a supplier's sheet scales. */
export const printScaleFor = (profile: Pick<FabricProfile, "shrinkLengthPct" | "shrinkWidthPct">): PrintScale => contractPrintScale(profile);

const four = (n: number): string => n.toFixed(4);

/** The print scale in words, for a screen or a file's margin. */
export function describePrintScale(scale: PrintScale): string {
  if (scale.note !== null && scale.length === 1 && scale.width === 1) return scale.note;
  const both = `${four(scale.length)} along the length and ${four(scale.width)} across the width`;
  return scale.note === null ? `Artwork is printed ${both}, so the fabric shrinks back to size.` : `${scale.note} Artwork on the tested side is scaled: ${both}.`;
}
