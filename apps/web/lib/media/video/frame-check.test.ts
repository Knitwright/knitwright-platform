import { describe, expect, it } from "vitest";
import { generatedPng, marksFor, panelsFor, referencePng } from "@/lib/media-check/fixtures/synthetic";
import type { CheckInput, CheckReport } from "@/lib/media-check/types";
import { VIDEO_GAP_RULE } from "./formats";
import { checkClipFrames, checkedMoments, driftMessage, NO_FRAMES_MESSAGE, type SampledFrame } from "./frame-check";

const SIZE = 320;

const passed: CheckReport = { verdict: "passed", findings: [], failedChecks: [], measurements: [], thresholdsNote: "note" };
const rejected: CheckReport = {
  verdict: "rejected",
  findings: [{ code: "colour_changed", check: "colour", message: "The colour of body is too far from the design.", measured: 20, threshold: 10 }],
  failedChecks: ["colour"],
  measurements: [],
  thresholdsNote: "note",
};

const frame = (atMs: number, byte = 1): SampledFrame => ({ atMs, png: new Uint8Array([byte]) });

describe("checking a clip frame by frame", () => {
  it("measures every sampled frame, not only the first", async () => {
    const seen: Uint8Array[] = [];
    const report = await checkClipFrames({ reference: new Uint8Array([9]), frames: [frame(0, 1), frame(1500, 2), frame(3000, 3)], protectedRegions: [] }, async (input: CheckInput) => {
      seen.push(input.generated);
      return passed;
    });
    expect(seen).toHaveLength(3);
    expect(report.verdict).toBe("passed");
    expect(checkedMoments(report)).toEqual([0, 1500, 3000]);
    expect(report.message).toBeNull();
  });

  it("rejects the whole clip when one frame drifts, and says at which moment", async () => {
    const drifted = await checkClipFrames({ reference: new Uint8Array([9]), frames: [frame(0, 1), frame(4000, 2), frame(8000, 3)], protectedRegions: [] }, async (input) =>
      (input.generated[0] as number) >= 2 ? rejected : passed,
    );
    expect(drifted.verdict).toBe("rejected");
    expect(drifted.firstFailureMs).toBe(4000);
    expect(drifted.message).toBe(driftMessage(4000));
    expect(drifted.message).toContain("00:04");
    expect(drifted.message).toContain("Nothing was charged.");
    expect(drifted.ruleId).toBe(VIDEO_GAP_RULE);
  });

  it("checks the frames in time order, whatever order they arrive in", async () => {
    const report = await checkClipFrames({ reference: new Uint8Array([9]), frames: [frame(3000), frame(0), frame(1500)], protectedRegions: [] }, async () => passed);
    expect(checkedMoments(report)).toEqual([0, 1500, 3000]);
  });

  it("turns a clip away when no frames could be read out of it", async () => {
    const report = await checkClipFrames({ reference: new Uint8Array([9]), frames: [], protectedRegions: [] }, async () => passed);
    expect(report).toMatchObject({ verdict: "rejected", message: NO_FRAMES_MESSAGE, firstFailureMs: null });
  });

  it("turns a clip away when fewer frames came back than were asked for", async () => {
    const report = await checkClipFrames({ reference: new Uint8Array([9]), frames: [frame(0)], protectedRegions: [], expected: 5 }, async () => passed);
    expect(report.verdict).toBe("rejected");
    expect(report.message).toBe(NO_FRAMES_MESSAGE);
  });

  it("counts a frame the checker could not read at all as a rejection, never as a pass", async () => {
    const report = await checkClipFrames({ reference: new Uint8Array([9]), frames: [frame(0)], protectedRegions: [] }, async () => {
      throw new RangeError("the reference render has no garment in it");
    });
    expect(report.verdict).toBe("rejected");
    expect(report.frames[0]?.findings[0]?.code).toBe("unreadable_generated");
  });

  it("carries the checker's own note about its thresholds, so nothing reads as a tested figure", async () => {
    const report = await checkClipFrames({ reference: new Uint8Array([9]), frames: [frame(0)], protectedRegions: [] }, async () => passed);
    expect(report.thresholdsNote).toBe("note");
  });
});

describe("against the real picture checker", () => {
  it("passes a clip whose frames are all the garment the platform drew, and catches one that changes half way", async () => {
    const [reference, clean, recoloured] = await Promise.all([
      referencePng(SIZE),
      generatedPng({}, SIZE),
      generatedPng({ base: "#7a1020" }, SIZE),
    ]);
    const input = { reference, protectedRegions: marksFor(SIZE), panels: panelsFor(SIZE) };

    const good = await checkClipFrames({ ...input, frames: [{ atMs: 0, png: clean }, { atMs: 3000, png: clean }] });
    expect(good.verdict).toBe("passed");

    const drifted = await checkClipFrames({ ...input, frames: [{ atMs: 0, png: clean }, { atMs: 3000, png: recoloured }] });
    expect(drifted.verdict).toBe("rejected");
    expect(drifted.firstFailureMs).toBe(3000);
    expect(drifted.frames[0]?.verdict).toBe("passed");
    expect(drifted.frames[1]?.failedChecks).toContain("colour");
  }, 30_000);
});
