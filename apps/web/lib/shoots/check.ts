import { checkGeneration } from "@/lib/media-check";
import { THRESHOLDS_NOTE } from "@/lib/media-check/settings";
import type { CheckInput, CheckName, CheckReport, Finding, ProtectedRegion } from "@/lib/media-check/types";
import { SHOOT_GAP_RULE } from "./types";

/**
 * THE GARMENT CHECKER ON EVERY RESULT (spec F-L1's rules: "The garment checker compares the garment
 * region to the render: crest, sponsor and number legibility, panel positions, colour ΔE. Failures
 * auto-regenerate once, then show 'Couldn't keep your garment accurate, try another pose'").
 *
 * `lib/media-check` does the measuring: it is the picture checker the platform already has, and this
 * file does not reimplement a single number of it. What this file adds is the three things F-L1 asks
 * for around it:
 *
 *   1. **every result is measured.** There is no path in `run.ts` that keeps a picture without
 *      coming through here, and a picture the checker could not read at all counts as turned away
 *      rather than as kept.
 *   2. **one automatic second attempt**, and only one. `attemptsAllowed` is 2 and `shouldRetry` says
 *      when the second is due, so the number lives in one place instead of in a loop somebody could
 *      change by accident.
 *   3. **the spec's own sentence**, word for word, when the second attempt is turned away too, with
 *      what it cost said beside it, because the credits come back.
 */

/** F-L1's own words for a shoot the checker turned away twice. Not re-worded. */
export const DRIFT_MESSAGE = "Couldn't keep your garment accurate, try another pose";

/** What is added after it, so the person knows the money came back. */
export const REFUNDED_LINE = "The credits for this shoot have been given back.";

/** How many attempts one shoot gets: the first, and the one automatic retry F-L1 asks for. */
export const ATTEMPTS_ALLOWED = 2;

export const UNREADABLE_MESSAGE = "The picture could not be read back as a picture, so it was not kept.";

export interface ShootCheckInput {
  /** The locked garment: the deterministic render or the golden-sample photo, on the same canvas. */
  readonly reference: Uint8Array;
  readonly generated: Uint8Array;
  readonly protectedRegions: readonly ProtectedRegion[];
  readonly panels?: CheckInput["panels"];
  readonly thresholds?: CheckInput["thresholds"];
}

export interface ShootCheckReport {
  readonly verdict: "kept" | "turned_away";
  readonly findings: readonly Finding[];
  readonly failedChecks: readonly CheckName[];
  /** What to tell the person, or null when the picture was kept. */
  readonly message: string | null;
  readonly thresholdsNote: string;
  readonly ruleId: string;
}

type Check = (input: CheckInput) => Promise<CheckReport>;

const UNREADABLE: Finding = {
  code: "unreadable_generated",
  check: "input",
  message: "This picture could not be read as a picture.",
  measured: 0,
  threshold: 1,
};

/** The sentence a turned-away shoot shows. The spec's words, then what happened to the money. */
export const driftMessage = (refunded: boolean): string => (refunded ? `${DRIFT_MESSAGE}. ${REFUNDED_LINE}` : `${DRIFT_MESSAGE}.`);

/**
 * One result, measured against the render. A picture the checker threw on is turned away rather than
 * kept, because a check that did not happen is not a check that said yes.
 */
export async function checkShootResult(input: ShootCheckInput, check: Check = checkGeneration): Promise<ShootCheckReport> {
  let report: CheckReport;
  try {
    report = await check({
      reference: input.reference,
      generated: input.generated,
      protectedRegions: input.protectedRegions,
      ...(input.panels ? { panels: input.panels } : {}),
      ...(input.thresholds ? { thresholds: input.thresholds } : {}),
    });
  } catch {
    return {
      verdict: "turned_away",
      findings: [UNREADABLE],
      failedChecks: ["input"],
      message: UNREADABLE_MESSAGE,
      thresholdsNote: THRESHOLDS_NOTE,
      ruleId: SHOOT_GAP_RULE,
    };
  }
  const kept = report.verdict === "passed";
  return {
    verdict: kept ? "kept" : "turned_away",
    findings: report.findings,
    failedChecks: report.failedChecks,
    message: kept ? null : driftMessage(false),
    thresholdsNote: report.thresholdsNote,
    ruleId: SHOOT_GAP_RULE,
  };
}

/** Whether the one automatic second attempt is still due. True only after the first is turned away. */
export const shouldRetry = (report: ShootCheckReport, attempt: number): boolean =>
  report.verdict === "turned_away" && attempt < ATTEMPTS_ALLOWED;

/** What was measured, for the job record and for the evidence on the pull request. */
export const measuredChecks = (report: ShootCheckReport): readonly CheckName[] => report.failedChecks;
