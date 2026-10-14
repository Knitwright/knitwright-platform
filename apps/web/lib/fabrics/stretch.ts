import type { FabricValue } from "@/lib/production/contract";
import type { FabricWithProfile } from "./profile";

/** What the pattern block was drafted with. */
export type BlockReduction = Readonly<{
  /** The stretch reduction the pattern was drafted with, as a percentage of the width. */
  pct: number;
}>;

export type StretchStatus = "no-stretch-value" | "matches" | "differs" | "beyond-stretch";

export type StretchReductionResult = Readonly<{
  status: StretchStatus;
  blockReductionPct: number;
  /** The reduction a fabric test found right, or null when no test gave one. */
  testedReductionPct: number | null;
  warnings: readonly string[];
}>;

/** How far the block's reduction may sit from the tested one before it is worth saying so, in points. */
export const REDUCTION_TOLERANCE_POINTS = 0.5;

/**
 * The benchmark's own rule: its draft takes 5 % out of the width and says that assumes a fabric with
 * about 20 % width stretch or more, so about four times the reduction.
 * docs/owner/reference/fashioninsta-2026-10-14/Football_Jersey_No10_EU48_TechPack.pdf.
 */
export const STRETCH_PER_REDUCTION = 4;

const known = (v: FabricValue): v is FabricValue & { value: number } =>
  v.value !== null && (v.source === "fabric-test" || v.source === "supplier-sheet");

const shown = (n: number): string => `${Math.round(n * 10) / 10}`;

/**
 * Compares the reduction the pattern was drafted with against what the fabric's tests say. It never
 * decides a reduction on its own: it reports the tested one when a test gave it, and warns when the
 * block's reduction is more than the fabric can give or differs from the test.
 */
export function stretchReduction(fabric: FabricWithProfile, block: BlockReduction): StretchReductionResult {
  const tested = known(fabric.reduction) ? fabric.reduction.value : null;
  const width = fabric.profile.stretchWidthPct;
  const warnings: string[] = [];
  let status: StretchStatus = "matches";

  if (known(width) && block.pct > width.value) {
    status = "beyond-stretch";
    warnings.push(`The pattern takes ${shown(block.pct)} % out of the width, but this fabric only stretches ${shown(width.value)} % across. It would fit too tight.`);
  } else if (known(width) && width.value < block.pct * STRETCH_PER_REDUCTION) {
    status = "differs";
    warnings.push(
      `The pattern takes ${shown(block.pct)} % out of the width, which the draft assumes for a fabric that stretches about ${shown(block.pct * STRETCH_PER_REDUCTION)} % across. This fabric stretches ${shown(width.value)} %.`,
    );
  }
  if (tested !== null && Math.abs(tested - block.pct) > REDUCTION_TOLERANCE_POINTS) {
    if (status === "matches") status = "differs";
    warnings.push(`The pattern is reduced by ${shown(block.pct)} %, but the test of this fabric found ${shown(tested)} % right. Draft the pattern again with ${shown(tested)} %.`);
  }
  if (!known(width) && tested === null) {
    return {
      status: "no-stretch-value",
      blockReductionPct: block.pct,
      testedReductionPct: null,
      warnings: [`This fabric has no stretch value, so the pattern's ${shown(block.pct)} % reduction cannot be compared with it. Test the fabric.`],
    };
  }
  return { status, blockReductionPct: block.pct, testedReductionPct: tested, warnings };
}
