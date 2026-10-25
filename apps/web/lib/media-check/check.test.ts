import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { checkGeneration } from "./check";
import { generatedPng, marksFor, panelsFor, referencePng, toPng, jerseySvg } from "./fixtures/synthetic";
import type { CheckReport, FindingCode } from "./types";

const SIZE = 640;

async function run(variant = {}, extra: Partial<Parameters<typeof checkGeneration>[0]> = {}): Promise<CheckReport> {
  return checkGeneration({
    reference: await referencePng(SIZE),
    generated: await generatedPng(variant, SIZE),
    protectedRegions: marksFor(SIZE),
    panels: panelsFor(SIZE),
    ...extra,
  });
}

const codes = (r: CheckReport): FindingCode[] => r.findings.map((f) => f.code);

describe("checkGeneration: pictures that should pass", () => {
  it("passes a clean copy with nothing measured over its limit", async () => {
    const report = await run();
    expect(report.findings).toEqual([]);
    expect(report.verdict).toBe("passed");
    expect(report.failedChecks).toEqual([]);
    expect(report.measurements.every((m) => m.status !== "failed")).toBe(true);
    expect(report.thresholdsNote).toBe("Knitwright default, not tested against real generations");
  });

  it.each([0.12, 0.25])("passes a copy relit with a soft gradient of strength %s", async (relight) => {
    const report = await run({ relight });
    expect(codes(report)).toEqual([]);
  });

  it("passes a copy at another size on the same canvas shape", async () => {
    const report = await checkGeneration({
      reference: await referencePng(SIZE),
      generated: await generatedPng({}, 400),
      protectedRegions: marksFor(SIZE),
      panels: panelsFor(SIZE),
    });
    expect(report.verdict).toBe("passed");
  });

  it("treats the whole garment as one panel when no panels are given", async () => {
    const report = await run({}, { panels: undefined });
    expect(report.verdict).toBe("passed");
    expect(report.measurements.some((m) => m.regionId === "garment" && m.check === "colour")).toBe(true);
  });

  it("gives the same report for the same bytes", async () => {
    expect(JSON.stringify(await run({ relight: 0.1 }))).toBe(JSON.stringify(await run({ relight: 0.1 })));
  });
});

describe("checkGeneration: pictures that should be rejected", () => {
  it.each([
    ["a hue-shifted body", { base: "#7a1f14", sleeve: "#1f7a3a" }, "colour_changed", "colour"],
    ["a moved stripe", { stripeShift: 60 }, "structure_moved", "structure"],
    ["a warped crest", { crestTransform: "rotate(28) scale(1.25 0.7) skewX(20)" }, "protected_warped", "protected"],
    ["a missing crest", { hideCrest: true }, "protected_missing", "protected"],
    ["a garment shifted off the canvas", { shiftX: 160 }, "not_aligned", "alignment"],
  ] as const)("rejects %s", async (_name, variant, code, check) => {
    const report = await run(variant);
    expect(report.verdict).toBe("rejected");
    expect(codes(report)).toContain(code);
    expect(report.failedChecks).toContain(check);
  });

  it("names the panel whose colour changed and leaves the others alone", async () => {
    const report = await run({ sleeve: "#2a9d8f" });
    const colour = report.findings.filter((f) => f.code === "colour_changed");
    expect(colour.map((f) => f.regionId).sort()).toEqual(["left-sleeve", "right-sleeve"]);
    const f = colour[0]!;
    expect(f.measured).toBeGreaterThan(f.threshold);
    expect(f.message).toMatch(/left-sleeve|right-sleeve/);
  });

  it("stops at alignment and says so, instead of passing or measuring nonsense", async () => {
    const report = await run({ shiftX: 160 });
    expect(report.failedChecks).toEqual(["alignment"]);
    expect(report.measurements).toHaveLength(1);
  });

  it("rejects a mark that has been recoloured but not reshaped", async () => {
    const reference = await referencePng(SIZE);
    const recoloured = (await toPng(jerseySvg({ background: "#dcdcdc" }).replace("#fca311", "#00a8e8").replace("#ffffff", "#111111"), SIZE));
    const report = await checkGeneration({ reference, generated: recoloured, protectedRegions: marksFor(SIZE), panels: panelsFor(SIZE) });
    expect(codes(report)).toEqual(expect.arrayContaining(["protected_warped"]));
  });
});

describe("checkGeneration: inputs", () => {
  it("rejects bytes that are not a picture", async () => {
    const report = await run({}, { generated: new Uint8Array([1, 2, 3]) });
    expect(codes(report)).toEqual(["unreadable_generated"]);
    expect(report.failedChecks).toEqual(["input"]);
  });

  it("rejects a picture on a different canvas shape", async () => {
    const wide = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#dcdcdc" } }).png().toBuffer();
    const report = await run({}, { generated: wide });
    expect(codes(report)).toEqual(["canvas_mismatch"]);
  });

  it("throws for a reference that cannot be read", async () => {
    await expect(run({}, { reference: new Uint8Array([1, 2, 3]) })).rejects.toThrow("reference render could not be opened");
  });

  it("throws for a reference with no garment in it", async () => {
    const empty = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await expect(run({}, { reference: empty, generated: empty })).rejects.toThrow("no garment");
  });

  it("applies threshold overrides and refuses nonsense ones", async () => {
    const strict = await run({ relight: 0.12 }, { thresholds: { maxColourDeltaE: 1 } });
    expect(codes(strict)).toContain("colour_changed");
    const mild = { base: "#1d3557" };
    expect(codes(await run(mild))).toEqual([]);
    expect(codes(await run(mild, { thresholds: { maxColourDeltaE: 5 } }))).toEqual(["colour_changed"]);
    await expect(run({}, { thresholds: { minMaskOverlap: 4 } })).rejects.toThrow();
  });

  it("reports a mark off the canvas as a finding", async () => {
    const report = await run({}, { protectedRegions: [{ id: "far", kind: "number", x: 5000, y: 5000, width: 10, height: 10 }] });
    expect(codes(report)).toEqual(["protected_missing"]);
  });

  it("skips a flat panel and a flat mark instead of inventing a number", async () => {
    const flat = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: "#14213d" } }).png().toBuffer();
    const report = await checkGeneration({
      reference: flat,
      generated: flat,
      protectedRegions: [{ id: "blank", kind: "sponsor", x: 100, y: 100, width: 100, height: 40 }],
      panels: [{ id: "body", x: 0, y: 0, width: SIZE, height: SIZE }, { id: "off", x: 9000, y: 9000, width: 10, height: 10 }],
    });
    expect(report.verdict).toBe("passed");
    expect(report.measurements.filter((m) => m.status === "skipped").length).toBeGreaterThanOrEqual(3);
  });
});
