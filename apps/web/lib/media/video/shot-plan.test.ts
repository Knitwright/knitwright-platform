import { describe, expect, it } from "vitest";
import { VIDEO_FPS, VIDEO_GAP_RULE } from "./formats";
import { VIDEO_SEQUENCES } from "./sequences";
import {
  buildRenderPlan,
  cameraAt,
  overlayBox,
  overlaysAt,
  planProgress,
  sampleTimes,
  shotAt,
  type TextOverlay,
} from "./shot-plan";

const overlay = (over: Partial<TextOverlay> = {}): TextOverlay => ({
  id: "headline",
  text: "New kit",
  fromMs: 0,
  toMs: 2000,
  xPercent: 50,
  yPercent: 10,
  align: "centre",
  sizePercent: 8,
  role: "headline",
  ...over,
});

describe("the render plan", () => {
  it("is the same plan every time for the same sequence, aspect and text", () => {
    const input = { sequence: VIDEO_SEQUENCES.kit_reveal, aspect: "9:16" as const, overlays: [overlay()], sampleFrames: 5 };
    expect(buildRenderPlan(input)).toEqual(buildRenderPlan(input));
  });

  it("puts the shots end to end with no gap, and ends where the sequence says", () => {
    const plan = buildRenderPlan({ sequence: VIDEO_SEQUENCES.kit_reveal, aspect: "1:1" });
    expect(plan.shots.map((shot) => [shot.fromMs, shot.toMs])).toEqual([
      [0, 3000],
      [3000, 6000],
      [6000, 8000],
    ]);
    expect(plan.durationMs).toBe(8000);
    expect(plan.frames).toBe(8 * VIDEO_FPS);
  });

  it("takes its size from the aspect and carries the sequence's rule id", () => {
    const plan = buildRenderPlan({ sequence: VIDEO_SEQUENCES.turntable, aspect: "16:9" });
    expect(plan.format).toMatchObject({ width: 1920, height: 1080 });
    expect(plan.ruleId).toBe(VIDEO_GAP_RULE);
    expect(plan.sequenceKey).toBe("turntable");
  });

  it("samples only the first frame unless it is told how many frames to sample", () => {
    expect(buildRenderPlan({ sequence: VIDEO_SEQUENCES.flip, aspect: "1:1" }).sampleMs).toEqual([0]);
  });
});

describe("the frames the checker samples", () => {
  it("spreads them from the first frame to the last, so a drift half way through is caught", () => {
    const times = sampleTimes(6000, 5, 30);
    expect(times).toHaveLength(5);
    expect(times[0]).toBe(0);
    expect(times[4]).toBe(Math.round(6000 - 1000 / 30));
    expect([...times].sort((a, b) => a - b)).toEqual([...times]);
    expect(new Set(times).size).toBe(5);
  });

  it("samples the first frame alone when one frame is asked for", () => {
    expect(sampleTimes(9000, 1)).toEqual([0]);
    expect(sampleTimes(9000, 0)).toEqual([0]);
    expect(sampleTimes(9000, -3)).toEqual([0]);
  });

  it("never samples past the end of the video", () => {
    for (const count of [2, 3, 7, 30]) {
      const times = sampleTimes(4000, count, 30);
      expect(Math.max(...times)).toBeLessThan(4000);
      expect(Math.min(...times)).toBe(0);
    }
  });

  it("samples a video with no length at all without failing", () => {
    expect(sampleTimes(0, 4)).toEqual([0, 0, 0, 0]);
  });
});

describe("what is on screen at a moment", () => {
  const plan = buildRenderPlan({ sequence: VIDEO_SEQUENCES.kit_reveal, aspect: "9:16" });

  it("gives the shot at that moment, and nothing outside the video", () => {
    expect(shotAt(plan, 0)?.shotId).toBe("fabric");
    expect(shotAt(plan, 2999)?.shotId).toBe("fabric");
    expect(shotAt(plan, 3000)?.shotId).toBe("shirt");
    expect(shotAt(plan, 7999)?.shotId).toBe("crest");
    expect(shotAt(plan, 8000)).toBeNull();
    expect(shotAt(plan, -1)).toBeNull();
  });

  it("turns the garment evenly through a turntable", () => {
    const turntable = buildRenderPlan({ sequence: VIDEO_SEQUENCES.turntable, aspect: "1:1" });
    expect(cameraAt(turntable, 0)?.degrees).toBe(0);
    expect(cameraAt(turntable, 3000)?.degrees).toBe(180);
    expect(cameraAt(turntable, 5999)?.degrees).toBeCloseTo(359.94, 1);
    expect(cameraAt(turntable, 6000)).toBeNull();
  });

  it("moves the camera in on a push-in and holds it still on a hold", () => {
    expect(cameraAt(plan, 0)).toMatchObject({ zoom: 2.4, subject: "fabric" });
    expect(cameraAt(plan, 1500)?.zoom).toBeCloseTo(2, 5);
    expect(cameraAt(plan, 4000)).toMatchObject({ zoom: 1, subject: "garment" });
    expect(cameraAt(plan, 7999)?.zoom).toBeCloseTo(2.2, 1);
  });

  it("names the kit on screen through a carousel", () => {
    const carousel = buildRenderPlan({ sequence: VIDEO_SEQUENCES.carousel, aspect: "1:1" });
    expect(cameraAt(carousel, 500)?.colourway).toBe("home");
    expect(cameraAt(carousel, 4000)?.colourway).toBe("away");
    expect(cameraAt(carousel, 8000)?.colourway).toBe("gk");
  });
});

describe("honest progress", () => {
  const plan = buildRenderPlan({ sequence: VIDEO_SEQUENCES.kit_reveal, aspect: "1:1" });

  it("says which part is being recorded and how far through the whole video it is", () => {
    expect(planProgress(plan, 0)).toEqual({ part: 0, label: "Close on the fabric", shotIndex: 0, shotCount: 3 });
    expect(planProgress(plan, 4000)).toMatchObject({ label: "Out to the whole shirt", shotIndex: 1, part: 0.5 });
    expect(planProgress(plan, 7000)).toMatchObject({ label: "In on the crest", shotIndex: 2 });
  });

  it("holds the ends rather than reading past them", () => {
    expect(planProgress(plan, -500)).toMatchObject({ part: 0, shotIndex: 0 });
    expect(planProgress(plan, 99_000)).toMatchObject({ part: 1, shotIndex: 2 });
  });
});

describe("text burned into the picture", () => {
  const plan = buildRenderPlan({
    sequence: VIDEO_SEQUENCES.turntable,
    aspect: "9:16",
    overlays: [overlay(), overlay({ id: "chip", text: "Order now", fromMs: 3000, toMs: 6000, role: "chip" })],
  });

  it("shows each overlay only between its own two moments", () => {
    expect(overlaysAt(plan, 0).map((one) => one.id)).toEqual(["headline"]);
    expect(overlaysAt(plan, 2500)).toEqual([]);
    expect(overlaysAt(plan, 3000).map((one) => one.id)).toEqual(["chip"]);
    expect(overlaysAt(plan, 6000)).toEqual([]);
  });

  it("turns a slot's shares into whole pixels on this plan's canvas", () => {
    expect(overlayBox(plan, overlay())).toEqual({ x: 540, y: 192, size: 154 });
  });

  it("keeps a slot in the same place on the picture whatever the aspect", () => {
    const wide = buildRenderPlan({ sequence: VIDEO_SEQUENCES.turntable, aspect: "16:9", overlays: [overlay()] });
    expect(overlayBox(wide, overlay())).toEqual({ x: 960, y: 108, size: 86 });
  });
});
