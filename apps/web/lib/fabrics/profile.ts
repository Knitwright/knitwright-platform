import type { FabricProfile, FabricValue } from "@/lib/production/contract";

export const NOT_SET: FabricValue = { value: null, source: "not-set" };

/** An empty profile: every number "not set". */
export const EMPTY_PROFILE: FabricProfile = Object.freeze({
  stretchLengthPct: NOT_SET,
  stretchWidthPct: NOT_SET,
  recoveryPct: NOT_SET,
  shrinkLengthPct: NOT_SET,
  shrinkWidthPct: NOT_SET,
  gsm: NOT_SET,
  usableWidthMm: NOT_SET,
});

/** What one saved test found. Fields a test did not measure are null. */
export type FabricTest = Readonly<{
  id: string;
  fabricId: string;
  testedBy: string;
  testedOn: string;
  method: string;
  loadNewtons: number | null;
  stretchLengthPct: number | null;
  stretchWidthPct: number | null;
  recoveryPct: number | null;
  shrinkLengthPct: number | null;
  shrinkWidthPct: number | null;
  pressTempC: number | null;
  pressSeconds: number | null;
  reductionPct: number | null;
  photoFileIds: readonly string[];
  createdAt: string;
}>;

/** A fabric as the brand has it: the supplier's sheet and the tests, with the profile worked out from both. */
export type FabricWithProfile = Readonly<{
  /** What the profile is, with each value's source. */
  profile: FabricProfile;
  /** The reduction the newest test that gave one found right, or not set. */
  reduction: FabricValue;
}>;

type Tested = "stretchLengthPct" | "stretchWidthPct" | "recoveryPct" | "shrinkLengthPct" | "shrinkWidthPct";

/** Newest test first: by the day it was run, then by when it was saved, then by id so ties are stable. */
const newestFirst = (a: FabricTest, b: FabricTest): number =>
  b.testedOn.localeCompare(a.testedOn) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/**
 * Each tested number comes from the newest test that measured it, and says which test. A number no
 * test measured stays as the supplier's sheet gave it, or not set. A test is the only way a value
 * becomes "fabric test".
 */
export function profileWithTests(sheet: FabricProfile, tests: readonly FabricTest[]): FabricWithProfile {
  const ordered = [...tests].sort(newestFirst);
  const pick = (field: Tested): FabricValue => {
    const test = ordered.find((t) => t[field] !== null);
    return test ? { value: test[field] as number, source: "fabric-test", testId: test.id } : sheet[field];
  };
  const withReduction = ordered.find((t) => t.reductionPct !== null);
  return {
    profile: {
      ...sheet,
      stretchLengthPct: pick("stretchLengthPct"),
      stretchWidthPct: pick("stretchWidthPct"),
      recoveryPct: pick("recoveryPct"),
      shrinkLengthPct: pick("shrinkLengthPct"),
      shrinkWidthPct: pick("shrinkWidthPct"),
    },
    reduction: withReduction ? { value: withReduction.reductionPct as number, source: "fabric-test", testId: withReduction.id } : NOT_SET,
  };
}
