import type { ChangedField } from "./surface";
import { describeChanged } from "./surface";
import { blocker, GAP_RULE_ID, type GoldenSampleState, type MakeFinding, warning } from "./vocabulary";

/**
 * The gate on a run (F-S7 acceptance: "a run cannot be placed without an approved golden sample"). A run may be made
 * when a golden sample of the version being made has been signed off, or when one of a parent version has and the two
 * versions differ only on the surface (`surface.ts`).
 *
 * This is the screen's copy of the rule. The database holds the same one and is what actually stops a run:
 * `submit_make_order` refuses with `golden_sample_required`, and a carry-over from a parent version exists only as a
 * `golden_sample_carryovers` row that `carry_over_golden_sample` wrote after refusing any field not labelled surface.
 */

export interface SignedOffSample {
  readonly id: string;
  /** The saved version of the design the sample was cut from. */
  readonly designVersion: number;
  readonly state: GoldenSampleState;
  /** Null until it is signed off. */
  readonly approvedAt: string | null;
  /** How the version being made differs from this sample's version. Null when nobody has compared them. */
  readonly changedSince: readonly ChangedField[] | null;
}

export type RunGate =
  | Readonly<{
      status: "ready";
      goldenSampleId: string;
      fromVersion: number;
      /** True when the sign-off is a parent version's, carried forward. */
      carriedOver: boolean;
      notes: readonly MakeFinding[];
    }>
  | Readonly<{ status: "blocked"; finding: MakeFinding }>;

const signedOff = (sample: SignedOffSample): boolean => sample.state === "approved" && sample.approvedAt !== null;

const newestFirst = (samples: readonly SignedOffSample[]): readonly SignedOffSample[] =>
  [...samples].sort((a, b) => b.designVersion - a.designVersion || (b.approvedAt ?? "").localeCompare(a.approvedAt ?? ""));

/** The note that goes with every carried-over sign-off: its colour readings were taken on another version's colours. */
export const carriedOverNote = (fromVersion: number, changed: readonly ChangedField[]): MakeFinding =>
  warning(
    "golden_sample_carried_over",
    `This run is covered by the golden sample signed off for version ${fromVersion}, which differs only on the surface (${describeChanged(changed)}). Its colour readings were taken on that version's own colours.`,
    GAP_RULE_ID,
  );

/** Whether a run of `designVersion` may be handed over, and why not when it may not. */
export function runGate(designVersion: number, samples: readonly SignedOffSample[]): RunGate {
  const available = newestFirst(samples.filter(signedOff));
  const exact = available.find((sample) => sample.designVersion === designVersion);
  if (exact) return { status: "ready", goldenSampleId: exact.id, fromVersion: exact.designVersion, carriedOver: false, notes: [] };

  const parent = available.find((sample) => sample.changedSince !== null && sample.changedSince.length > 0 && sample.changedSince.every((one) => one.group === "surface"));
  if (parent) {
    return {
      status: "ready",
      goldenSampleId: parent.id,
      fromVersion: parent.designVersion,
      carriedOver: true,
      notes: [carriedOverNote(parent.designVersion, parent.changedSince ?? [])],
    };
  }

  const structural = available.find((sample) => sample.changedSince !== null && sample.changedSince.some((one) => one.group === "structural"));
  const because =
    available.length === 0
      ? "No golden sample has been signed off for this product yet."
      : structural
        ? `The golden sample signed off for version ${structural.designVersion} does not cover version ${designVersion}: ${describeChanged(structural.changedSince?.filter((one) => one.group === "structural") ?? [])} changed, which is more than the surface.`
        : `No golden sample covers version ${designVersion}.`;
  return {
    status: "blocked",
    finding: blocker("golden_sample_required", `${because} Order a sample, judge it, and sign it off before a run.`),
  };
}

/** What the "Order a run" button says when it is off. */
export const whyNoRun = (gate: RunGate): string | null => (gate.status === "blocked" ? gate.finding.message : null);
