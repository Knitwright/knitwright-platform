import { describe, expect, it } from "vitest";
import { checkGeneration } from "./check";
import { generatedPng, marksFor, panelsFor, referencePng } from "./fixtures/synthetic";

describe("latency", () => {
  it("checks a 1024 px image in under a second", async () => {
    const input = { reference: await referencePng(1024), generated: await generatedPng({ relight: 0.1 }, 1024), protectedRegions: marksFor(1024), panels: panelsFor(1024) };
    await checkGeneration(input); // the first call loads the image library; the limit is for the work itself
    const started = performance.now();
    const report = await checkGeneration(input);
    const took = performance.now() - started;
    expect(report.verdict).toBe("passed");
    expect(took).toBeLessThan(1000);
  });
});
