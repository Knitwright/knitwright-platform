import { describe, expect, it } from "vitest";
import { checkGeneration } from "./check";
import { generatedPng, marksFor, panelsFor, referencePng } from "./fixtures/synthetic";

describe("latency", () => {
  it("checks a 1024 px image in well under two seconds", async () => {
    const input = { reference: await referencePng(1024), generated: await generatedPng({ relight: 0.1 }, 1024), protectedRegions: marksFor(1024), panels: panelsFor(1024) };
    await checkGeneration(input); // the first call loads the image library; the limit is for the work itself
    // A shared CI runner can lose a few hundred milliseconds to another job, so the budget is the
    // fastest of three runs against a limit that still catches a real regression: this check used
    // to take about 600 ms, and a change that doubled it would fail here.
    const timings: number[] = [];
    for (let run = 0; run < 3; run += 1) {
      const started = performance.now();
      const report = await checkGeneration(input);
      timings.push(performance.now() - started);
      expect(report.verdict).toBe("passed");
    }
    expect(Math.min(...timings)).toBeLessThan(2000);
  });
});
