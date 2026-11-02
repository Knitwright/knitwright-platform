import { checkGeneration } from "@/lib/media-check";
import { THRESHOLDS_NOTE } from "@/lib/media-check/settings";
import type { CheckInput, CheckName, CheckReport, Finding, ProtectedRegion } from "@/lib/media-check/types";
import { clock, VIDEO_GAP_RULE } from "./formats";

/**
 * THE CHECKER, SAMPLING FRAMES (spec F-L3: "the first frame is always a garment-locked image, and
 * the checker samples frames").
 *
 * `lib/media-check` measures one picture against the deterministic render. A clip is a few hundred
 * pictures, and a model that keeps the garment for a second and then drifts would pass a check of the
 * first frame alone. So a clip is checked at several moments spread across its whole length
 * (`sampleTimes` in `shot-plan.ts`, how many of them a platform setting), and the clip's verdict is
 * the worst of them: **one bad frame rejects the clip**, and the report says at which moment, so the
 * message can tell the person where it went wrong and the credits can be given back.
 *
 * Where the frames come from is the caller's business: the browser samples them out of the finished
 * clip with a `<video>` element and a canvas (`components/video/sample-frames.ts`), which works on
 * every deploy target because no server-side decoder is needed. This file never decodes a video.
 */

export interface SampledFrame {
  /** The moment in the clip this picture was taken at, in milliseconds. */
  readonly atMs: number;
  /** The frame as a PNG, on the same canvas as the reference render. */
  readonly png: Uint8Array;
}

export interface FrameCheckInput {
  /** The garment-locked first frame: the deterministic render or the golden-sample photo. */
  readonly reference: Uint8Array;
  readonly frames: readonly SampledFrame[];
  readonly protectedRegions: readonly ProtectedRegion[];
  readonly panels?: CheckInput["panels"];
  readonly thresholds?: CheckInput["thresholds"];
  /** How many frames were asked for, so a clip that gave back fewer is caught. */
  readonly expected?: number;
}

export interface FrameVerdict {
  readonly atMs: number;
  readonly verdict: "passed" | "rejected";
  readonly findings: readonly Finding[];
  readonly failedChecks: readonly CheckName[];
}

export interface ClipCheckReport {
  readonly verdict: "passed" | "rejected";
  readonly frames: readonly FrameVerdict[];
  /** The first moment a frame was turned away, or null. */
  readonly firstFailureMs: number | null;
  /** What to tell the person, or null when the clip passed. */
  readonly message: string | null;
  readonly thresholdsNote: string | null;
  readonly ruleId: string;
}

export const NO_FRAMES_MESSAGE = "The clip could not be read back frame by frame, so it was not kept. Nothing was charged.";

const DRIFT_MESSAGE = "The garment changed part way through the clip";

/** The one sentence the person is shown for a clip the checker turned away. */
export function driftMessage(atMs: number): string {
  return `${DRIFT_MESSAGE} (at ${clock(atMs / 1000)}), so it was not kept. Try another preset or a shorter clip. Nothing was charged.`;
}

type Check = (input: CheckInput) => Promise<CheckReport>;

const verdictOf = (frame: SampledFrame, report: CheckReport): FrameVerdict => ({
  atMs: frame.atMs,
  verdict: report.verdict,
  findings: report.findings,
  failedChecks: report.failedChecks,
});

/**
 * Checks every sampled frame against the reference. Each frame is measured on its own, so the report
 * says which moment drifted; a frame the checker could not read at all counts as a rejection, never
 * as a pass.
 */
export async function checkClipFrames(input: FrameCheckInput, check: Check = checkGeneration): Promise<ClipCheckReport> {
  const wanted = input.expected ?? input.frames.length;
  if (input.frames.length === 0 || input.frames.length < wanted) {
    return { verdict: "rejected", frames: [], firstFailureMs: null, message: NO_FRAMES_MESSAGE, thresholdsNote: null, ruleId: VIDEO_GAP_RULE };
  }
  const frames: FrameVerdict[] = [];
  let note: string | null = null;
  for (const frame of [...input.frames].sort((a, b) => a.atMs - b.atMs)) {
    const report = await readFrame(check, input, frame);
    note = report.thresholdsNote;
    frames.push(verdictOf(frame, report));
  }
  const failed = frames.find((frame) => frame.verdict === "rejected") ?? null;
  return {
    verdict: failed ? "rejected" : "passed",
    frames,
    firstFailureMs: failed?.atMs ?? null,
    message: failed ? driftMessage(failed.atMs) : null,
    thresholdsNote: note,
    ruleId: VIDEO_GAP_RULE,
  };
}

const UNREADABLE: Finding = {
  code: "unreadable_generated",
  check: "input",
  message: "This frame of the clip could not be read as a picture.",
  measured: 0,
  threshold: 1,
};

/** One frame, with a frame the checker threw on counted as a rejection rather than a pass. */
async function readFrame(check: Check, input: FrameCheckInput, frame: SampledFrame): Promise<CheckReport> {
  try {
    return await check({
      reference: input.reference,
      generated: frame.png,
      protectedRegions: input.protectedRegions,
      ...(input.panels ? { panels: input.panels } : {}),
      ...(input.thresholds ? { thresholds: input.thresholds } : {}),
    });
  } catch {
    return { verdict: "rejected", findings: [UNREADABLE], failedChecks: ["input"], measurements: [], thresholdsNote: THRESHOLDS_NOTE };
  }
}

/** The moments that were measured, for the run record and for the PR's own evidence. */
export const checkedMoments = (report: ClipCheckReport): readonly number[] => report.frames.map((frame) => frame.atMs);
