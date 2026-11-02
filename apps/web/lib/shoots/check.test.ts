import { describe, expect, it } from "vitest";
import { generatedPng, marksFor, panelsFor, referencePng } from "@/lib/media-check/fixtures/synthetic";
import {
  ATTEMPTS_ALLOWED,
  DRIFT_MESSAGE,
  REFUNDED_LINE,
  UNREADABLE_MESSAGE,
  checkShootResult,
  driftMessage,
  measuredChecks,
  shouldRetry,
  type ShootCheckInput,
} from "./check";
import { SHOOT_GAP_RULE } from "./types";

/**
 * The checker on a result, against the picture checker the platform already has. The fixtures are
 * `lib/media-check`'s own synthetic jersey, drawn from an SVG: no photograph of anybody and no
 * third-party image is committed for this, and the variants stand in for the ways a generation goes
 * wrong.
 */

const SIZE = 320;

const input = async (over: Partial<ShootCheckInput> = {}): Promise<ShootCheckInput> => ({
  reference: await referencePng(SIZE),
  generated: await generatedPng({}, SIZE),
  protectedRegions: marksFor(SIZE),
  panels: panelsFor(SIZE),
  ...over,
});

describe("the checker on every result", () => {
  it("keeps a picture whose garment came through unchanged", async () => {
    const report = await checkShootResult(await input());
    expect(report.verdict).toBe("kept");
    expect(report.findings).toEqual([]);
    expect(report.message).toBeNull();
    expect(report.thresholdsNote).toBe("Knitwright default, not tested against real generations");
  });

  it("turns away a picture whose garment moved, and says the spec's own sentence", async () => {
    const report = await checkShootResult(await input({ generated: await generatedPng({ shiftX: 60 }, SIZE) }));
    expect(report.verdict).toBe("turned_away");
    expect(report.message).toMatch(DRIFT_MESSAGE);
    expect(report.failedChecks.length).toBeGreaterThan(0);
    expect(measuredChecks(report)).toEqual(report.failedChecks);
  });

  it("turns away a picture whose crest has gone", async () => {
    const report = await checkShootResult(await input({ generated: await generatedPng({ hideCrest: true }, SIZE) }));
    expect(report.verdict).toBe("turned_away");
    expect(report.findings.some((finding) => finding.check === "protected")).toBe(true);
  });

  it("turns away a picture whose colours were restyled", async () => {
    const report = await checkShootResult(await input({ generated: await generatedPng({ base: "#7a1f14", sleeve: "#1f7a3a" }, SIZE) }));
    expect(report.verdict).toBe("turned_away");
    expect(report.failedChecks).toContain("colour");
  });

  it("works without panels, measuring the whole garment as one", async () => {
    const report = await checkShootResult(await input({ panels: undefined }));
    expect(report.verdict).toBe("kept");
  });

  it("turns away a picture the checker could not read at all, rather than keeping it", async () => {
    const report = await checkShootResult(await input({ generated: new Uint8Array([1, 2, 3]) }));
    expect(report.verdict).toBe("turned_away");
    expect(report.message).toBe(UNREADABLE_MESSAGE);
    expect(report.findings[0]!.code).toBe("unreadable_generated");
    expect(report.ruleId).toBe(SHOOT_GAP_RULE);
  });

  it("turns away a result when the checker itself throws, rather than keeping an unmeasured picture", async () => {
    const report = await checkShootResult(await input(), async () => {
      throw new Error("the checker fell over");
    });
    expect(report.verdict).toBe("turned_away");
    expect(report.message).toBe(UNREADABLE_MESSAGE);
    expect(report.failedChecks).toEqual(["input"]);
  });

  it("passes the thresholds a caller gives it through to the real checker", async () => {
    const strict = await checkShootResult(await input({ generated: await generatedPng({ relight: 0.25 }, SIZE), thresholds: { maxColourDeltaE: 1 } }));
    expect(strict.verdict).toBe("turned_away");
  });
});

describe("the one automatic second attempt F-L1 allows", () => {
  it("is due after the first result is turned away, and not after the second", async () => {
    const turned = await checkShootResult(await input({ generated: await generatedPng({ shiftX: 60 }, SIZE) }));
    expect(ATTEMPTS_ALLOWED).toBe(2);
    expect(shouldRetry(turned, 1)).toBe(true);
    expect(shouldRetry(turned, 2)).toBe(false);
  });

  it("is never due for a picture that was kept", async () => {
    expect(shouldRetry(await checkShootResult(await input()), 1)).toBe(false);
  });

  it("says what happened to the money when it is given up on", () => {
    expect(driftMessage(true)).toBe(`${DRIFT_MESSAGE}. ${REFUNDED_LINE}`);
    expect(driftMessage(false)).toBe(`${DRIFT_MESSAGE}.`);
  });
});
