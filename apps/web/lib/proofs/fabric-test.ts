import type { FabricValue } from "@/lib/production/contract";
import type { StrikeOff } from "./types";

export interface ShrinkTest {
  /** A name for the test record, so the numbers say where they came from. */
  readonly testId: string;
  readonly shrinkLengthPct: FabricValue;
  readonly shrinkWidthPct: FabricValue;
}

/**
 * The shrink measured on a strike-off, in the shape the fabric part keeps its values in, so it
 * can be saved there as a fabric test. Null until both directions were measured: half a test
 * would leave the other direction looking tested when it was not.
 */
export function shrinkTestFrom(strikeOff: Pick<StrikeOff, "id" | "shrinkLengthPct" | "shrinkWidthPct">): ShrinkTest | null {
  if (strikeOff.shrinkLengthPct === null || strikeOff.shrinkWidthPct === null) return null;
  const testId = `strike-off-${strikeOff.id}`;
  return {
    testId,
    shrinkLengthPct: { value: strikeOff.shrinkLengthPct, source: "fabric-test", testId },
    shrinkWidthPct: { value: strikeOff.shrinkWidthPct, source: "fabric-test", testId },
  };
}
