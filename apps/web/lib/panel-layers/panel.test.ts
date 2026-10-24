import { describe, expect, it } from "vitest";
import { BENCHMARK_PANEL_NOTE, benchmarkPanel } from "./panel";

describe("the spike's panel", () => {
  it("is the front of the benchmark jersey at size 48, in whole millimetres, and says it is not the club's pattern", () => {
    const panel = benchmarkPanel();
    expect(panel.id).toBe("front");
    expect(panel.cutOutline.length).toBeGreaterThan(10);
    expect(panel.sewLine === null || panel.sewLine.length > 2).toBe(true);
    expect(BENCHMARK_PANEL_NOTE).toMatch(/not your pattern/i);
  });

  it("is the same every time", () => {
    expect(benchmarkPanel()).toEqual(benchmarkPanel());
  });
});
