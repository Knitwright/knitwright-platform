import { describe, expect, it } from "vitest";
import { JERSEY_EU48, TEE_EU48 } from "@/lib/production/fixtures";
import { buildMeasurements } from "../measurements";
import { benchmarkJerseyInput, jerseyWithBenchmarkTargets, measureBenchmark } from "../fixtures/production";
import { buildOnPattern, patternSizeOf } from "./measured";

const table = () => buildMeasurements(jerseyWithBenchmarkTargets());
const run = (patternOnlyTargets: Parameters<typeof buildOnPattern>[3] = []) =>
  buildOnPattern(table(), measureBenchmark(JERSEY_EU48, "48"), [], patternOnlyTargets);

describe("the measurement table set against the pattern", () => {
  it("has no table while nothing is measured on a pattern", () => {
    expect(buildOnPattern(table(), [], [])).toBeNull();
  });

  it("re-derives the benchmark DXF values within 1 mm", () => {
    const measured = Object.fromEntries(measureBenchmark(JERSEY_EU48, "48").map((m) => [m.pointId, m.tenthsMm / 100]));
    expect(measured).toMatchObject({});
    expect(measured["body-length"]).toBeCloseTo(72.0, 0);
    expect(measured["chest-width"]).toBeCloseTo(50.7, 0);
    expect(measured["hem-width"]).toBeCloseTo(51.9, 0);
    expect(measured["sleeve-length"]).toBeCloseTo(20.5, 0);
    expect(measured["upper-arm"]).toBeCloseTo(18.6, 0);
    expect(measured["cap-height"]).toBeCloseTo(13.8, 0);
    expect(Math.abs((measureBenchmark(TEE_EU48, "48").find((m) => m.pointId === "body-length")?.tenthsMm ?? 0) - 6870)).toBeLessThanOrEqual(10);
  });

  it("shows the points where the benchmark PDF and its own DXF disagree, with the difference", () => {
    const result = run([{ pointId: "cap-height", size: "48", targetTenthsMm: 1450, toleranceTenthsMm: 30 }]);
    const cell = (id: string) => result?.rows.find((row) => row.pointId === id)?.cells[0];
    expect(cell("hem-width")).toMatchObject({ result: "outside", difference: { value: "+1.4" } });
    expect(cell("sleeve-length")).toMatchObject({ result: "outside", difference: { value: "-1.1" } });
    expect(cell("upper-arm")).toMatchObject({ result: "outside", difference: { value: "-0.7" } });
    const cap = result?.patternOnly.find((row) => row.pointId === "cap-height")?.cells[0];
    expect(cap).toMatchObject({ result: "outside", difference: { value: "-0.7" } });
    expect(cell("hem-width")?.flag).toBe("Measured 51.9 cm on the pattern against a target of 50.5 cm: 1.4 cm over, and the tolerance is ±1.0 cm.");
    expect(result?.outside).toBe(4);
    expect(result?.summary).toMatch(/^4 measurements are outside the tolerance\./);
  });

  it("calls a measurement inside its tolerance inside, with no flag", () => {
    const chest = run()?.rows.find((row) => row.pointId === "chest-width")?.cells[0];
    expect(chest).toMatchObject({ result: "inside", flag: null, difference: { value: "+0.2" } });
  });

  it("says which values are not measured, and which have no target or no tolerance", () => {
    const result = run();
    const status = (id: string) => result?.rows.find((row) => row.pointId === id)?.cells[0]?.result;
    expect(status("armhole")).toBe("not-measured");
    expect(status("body-length")).toBe("no-target");
    expect(result?.summary).toMatch(/values have not been measured on the pattern\.$/);
    const noTolerance = buildOnPattern(buildMeasurements(jerseyWithBenchmarkTargets()), [{ ...measureBenchmark(JERSEY_EU48, "48")[0]!, pointId: "neck-width" }], []);
    expect(noTolerance?.rows.find((row) => row.pointId === "neck-width")?.cells[0]?.result).toBe("no-target");
  });

  it("lists the points only a pattern gives, with no target until someone gives one", () => {
    const only = run()?.patternOnly;
    expect(only).toHaveLength(1);
    expect(only?.[0]).toMatchObject({ pointId: "cap-height", label: "Sleeve cap height" });
    expect(only?.[0]?.cells[0]).toMatchObject({ result: "no-target", target: { status: "to-be-confirmed" } });
    expect(only?.[0]?.cells[0]?.measured).toMatchObject({ provenance: "measured-from-pattern" });
  });

  it("names an unknown pattern-only point from its id", () => {
    const m = { ...measureBenchmark(JERSEY_EU48, "48")[0]!, pointId: "armhole-drop-test" };
    expect(buildOnPattern(table(), [m], [])?.patternOnly[0]?.label).toBe("Armhole drop test");
  });

  it("reads a size label as the pattern size of the same name unless a map says otherwise", () => {
    expect(patternSizeOf("M", [])).toBe("M");
    expect(patternSizeOf("M", [{ label: "M", wearer: "men", cut: "mens", patternSize: "48", source: "suggested" }])).toBe("48");
    const mapped = buildOnPattern(
      buildMeasurements({ ...jerseyWithBenchmarkTargets(), sizing: { sizes: ["M"], baseSize: "M" } }),
      measureBenchmark(JERSEY_EU48, "48"),
      [{ label: "M", wearer: "men", cut: "mens", patternSize: "48", source: "suggested" }],
    );
    expect(mapped?.rows.find((row) => row.pointId === "chest-width")?.cells[0]?.measured.status).toBe("set");
  });

  it("is a table of the benchmark input as the production input gives it", () => {
    expect(benchmarkJerseyInput().measured?.length).toBe(10);
  });
});
