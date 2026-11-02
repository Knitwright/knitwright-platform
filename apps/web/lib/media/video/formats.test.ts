import { describe, expect, it } from "vitest";
import {
  clock,
  DURATION_BOUNDS,
  durationVerdict,
  frameCount,
  isVideoAspect,
  VIDEO_ASPECTS,
  VIDEO_FORMATS,
  VIDEO_FPS,
  VIDEO_GAP_RULE,
  videoFormat,
} from "./formats";

describe("the video formats", () => {
  it("offers the three aspects the spec names, each at 1080p on its short side", () => {
    expect(VIDEO_ASPECTS).toEqual(["9:16", "1:1", "16:9"]);
    expect(VIDEO_FORMATS["9:16"]).toMatchObject({ width: 1080, height: 1920 });
    expect(VIDEO_FORMATS["1:1"]).toMatchObject({ width: 1080, height: 1080 });
    expect(VIDEO_FORMATS["16:9"]).toMatchObject({ width: 1920, height: 1080 });
  });

  it("gives every format a rule id and a note saying where the numbers came from", () => {
    for (const aspect of VIDEO_ASPECTS) {
      expect(VIDEO_FORMATS[aspect].ruleId).toBe(VIDEO_GAP_RULE);
      expect(VIDEO_FORMATS[aspect].note).toMatch(/spec/i);
    }
  });

  it("has sizes whose shape really is the aspect they claim", () => {
    const ratio = { "9:16": 9 / 16, "1:1": 1, "16:9": 16 / 9 } as const;
    for (const aspect of VIDEO_ASPECTS) {
      const format = VIDEO_FORMATS[aspect];
      expect(format.width / format.height).toBeCloseTo(ratio[aspect], 5);
    }
  });

  it("reads an aspect, and falls back to the square one for anything it does not know", () => {
    expect(isVideoAspect("9:16")).toBe(true);
    expect(isVideoAspect("4:5")).toBe(false);
    expect(videoFormat("16:9").aspect).toBe("16:9");
    expect(videoFormat("nonsense").aspect).toBe("1:1");
    expect(videoFormat(undefined).aspect).toBe("1:1");
  });
});

describe("how long a clip may be", () => {
  it("is the spec's 3 to 15 seconds, with a note that says so", () => {
    expect(DURATION_BOUNDS.minSeconds).toBe(3);
    expect(DURATION_BOUNDS.maxSeconds).toBe(15);
    expect(DURATION_BOUNDS.note).toMatch(/F-L3/);
  });

  it("accepts a whole number of seconds inside the bounds", () => {
    for (const seconds of [3, 7, 15]) expect(durationVerdict(seconds)).toEqual({ ok: true, seconds });
  });

  it("refuses a length outside the bounds and names both bounds in the message", () => {
    const answer = durationVerdict(2);
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.reason).toContain("3 to 15 seconds");
    expect(answer.reason).toContain("2");
    expect(answer.ruleId).toBe(VIDEO_GAP_RULE);
  });

  it("refuses a length that is not a whole number of seconds, rather than rounding it", () => {
    expect(durationVerdict(4.5).ok).toBe(false);
    expect(durationVerdict(Number.NaN).ok).toBe(false);
    expect(durationVerdict(Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it("never clamps: 16 seconds does not quietly become 15", () => {
    const answer = durationVerdict(16);
    expect(answer).not.toMatchObject({ ok: true, seconds: 15 });
  });
});

describe("frames and the clock", () => {
  it("counts frames at the studio's frame rate, and never fewer than one", () => {
    expect(frameCount(6)).toBe(6 * VIDEO_FPS);
    expect(frameCount(0)).toBe(1);
    expect(frameCount(2, 24)).toBe(48);
  });

  it("writes seconds as mm:ss", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(7)).toBe("00:07");
    expect(clock(65)).toBe("01:05");
    expect(clock(-3)).toBe("00:00");
  });
});
