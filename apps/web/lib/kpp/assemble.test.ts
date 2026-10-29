import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildPackage, KPP_GENERATOR_VERSION, type BuildResult } from "./assemble";
import { fixtureSources, JSY_BATCH, JSY_INPUT, JSY_PATTERN, tinyPdf } from "./fixtures/jsy-ss-01";
import type { KppInput } from "./model";

const ROOT = "KPP_ACME_Home_Kit_v3_SKT-01";
const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

const built = async (input: KppInput = JSY_INPUT, sources = fixtureSources()): Promise<Extract<BuildResult, { ok: true }>> => {
  const result = await buildPackage(input, sources);
  if (!result.ok) throw new Error(result.issues.map((i) => i.message).join("\n"));
  return result;
};

const entries = (zip: Uint8Array): Record<string, Uint8Array> => unzipSync(zip);
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

describe("buildPackage: the layout of docs/spec/04", () => {
  it("holds every path the spec lists for a sample package, under the package root", async () => {
    const { zip, root } = await built();
    expect(root).toBe(ROOT);
    const paths = Object.keys(entries(zip)).map((p) => p.slice(ROOT.length + 1));
    const expected = [
      "manifest.json",
      "00_README.pdf",
      "01_techpack/techpack.pdf",
      "01_techpack/techpack.json",
      "02_measurements/pom.csv",
      "02_measurements/size_chart_customer.pdf",
      ...SIZES.flatMap((s) => [`03_patterns/dxf_aama/JSY-SS-01_${s}.dxf`, `03_patterns/pdf_1to1/JSY-SS-01_${s}.pdf`, `03_patterns/svg/JSY-SS-01_${s}.svg`]),
      "03_patterns/dxf_aama/JSY-SS-01_nest.dxf",
      ...SIZES.flatMap((s) => ["front", "back", "sleeve-left", "sleeve-right"].map((p) => `04_print/${s}/SAMPLE_JSY-SS-01_${p}_${s}.pdf`)),
      "05_colour/colour_spec.pdf",
      "05_colour/colour_spec.json",
      "06_bom/bom.csv",
      "07_labels/care_label_uk.pdf",
      "07_labels/care_label_au.pdf",
      "09_qc/qc_checklist.pdf",
      "10_reference/renders_front_back.pdf",
    ];
    expect([...paths].sort()).toEqual([...expected].sort());
    expect(Object.keys(entries(zip)).every((p) => p.startsWith(`${ROOT}/`))).toBe(true);
  });

  it("adds the optional brand label and golden sample when they are given", async () => {
    const { zip } = await built(JSY_INPUT, fixtureSources({ brandLabelPdf: tinyPdf("Brand label"), goldenSamplePdf: tinyPdf("Golden") }));
    const paths = Object.keys(entries(zip));
    expect(paths).toContain(`${ROOT}/07_labels/brand_label.pdf`);
    expect(paths).toContain(`${ROOT}/10_reference/golden_sample.pdf`);
  });

  it("a batch adds the job sheet and names, and groups print files by order and size", async () => {
    const sources = fixtureSources();
    const { zip } = await built(JSY_BATCH, sources);
    const paths = Object.keys(entries(zip)).map((p) => p.slice(ROOT.length + 1));
    expect(paths).toContain("job_sheet.pdf");
    expect(paths).toContain("08_personalisation/names_numbers.csv");
    const prints = paths.filter((p) => p.startsWith("04_print/"));
    expect(prints).toContain("04_print/KW10422/M/KW10422_JSY-SS-01_front_M.pdf");
    expect(prints).toContain("04_print/KW10422/XL/KW10422_JSY-SS-01_back_XL.pdf");
    expect(prints).toContain("04_print/KW10423/S/KW10423_JSY-SS-01_sleeve-left_S.pdf");
    expect(prints).toHaveLength(3 * 4);
    expect(sources.calls).toEqual(["KW10422/M", "KW10422/XL", "KW10423/S"]);
    const names = text(entries(zip)[`${ROOT}/08_personalisation/names_numbers.csv`]);
    expect(names.split("\r\n")[0]).toBe("order_no,line_id,size,name,number,name_zone,number_zone,font_id,colour_hex");
    // A name a spreadsheet would read as a formula is written as text.
    expect(names).toContain("KW10422,L2,M,'=JONES,9");
  });

  it("names TIFF print files when the factory profile asks for them", async () => {
    const { zip } = await built({ ...JSY_INPUT, factory: { ...JSY_INPUT.factory, printFileType: "tif" } });
    expect(Object.keys(entries(zip))).toContain(`${ROOT}/04_print/M/SAMPLE_JSY-SS-01_front_M.tif`);
  });
});

describe("buildPackage: the manifest", () => {
  it("lists every other file with its sha256, size and generator, the design hash and the generator version", async () => {
    const { zip } = await built();
    const files = entries(zip);
    const manifest = JSON.parse(text(files[`${ROOT}/manifest.json`]));
    expect(manifest.generator).toEqual({ name: "knitwright-kpp", version: KPP_GENERATOR_VERSION });
    expect(manifest.design).toEqual({ code: "ACME_Home_Kit", article: "JSY-SS-01", version: 3, hash: "a".repeat(64) });
    expect(manifest.created).toBe(JSY_INPUT.design.createdAtIso);
    const others = Object.keys(files).filter((p) => !p.endsWith("/manifest.json"));
    expect(manifest.files).toHaveLength(others.length);
    for (const entry of manifest.files) {
      const bytes = files[`${ROOT}/${entry.path}`];
      expect(entry.sha256).toBe(sha(bytes));
      expect(entry.bytes).toBe(bytes.length);
      expect(entry.generator).toMatch(/\S/);
    }
  });
});

describe("buildPackage: determinism", () => {
  it("gives a byte-identical ZIP twice, although the tech pack generator reads the clock", async () => {
    const a = await built();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const b = await built();
    expect(sha(b.zip)).toBe(sha(a.zip));
  });

  it("pins every PDF date to the version's creation time", async () => {
    const { zip } = await built();
    for (const [path, bytes] of Object.entries(entries(zip))) {
      if (!path.endsWith(".pdf")) continue;
      const dates = Buffer.from(bytes).toString("latin1").match(/\/(CreationDate|ModDate) ?\(D:[0-9]{14}Z\)/g) ?? [];
      expect(dates.length, path).toBeGreaterThan(0);
      for (const d of dates) expect(d, path).toContain("D:20261025093000Z");
    }
  });

  it("changes when the design version changes", async () => {
    const a = await built();
    const b = await built({ ...JSY_INPUT, design: { ...JSY_INPUT.design, version: 4 } });
    expect(sha(b.zip)).not.toBe(sha(a.zip));
  });
});

describe("buildPackage: refusals", () => {
  it("refuses, listing the reasons, while any field needs input", async () => {
    const input: KppInput = { ...JSY_INPUT, fields: [...JSY_INPUT.fields, { id: "season", label: "Season", value: null, provenance: "needs_input", ruleId: "R-GAP-000" }] };
    const result = await buildPackage(input, fixtureSources());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.message)).toEqual(["Season: needs your input."]);
  });

  it("refuses when the pattern lacks a size of the run, and makes no print file", async () => {
    const sources = fixtureSources({ pattern: { pattern: async () => ({ ...JSY_PATTERN, sizes: ["M"], piecesBySize: { M: JSY_PATTERN.piecesBySize.M } }) } });
    const result = await buildPackage(JSY_INPUT, sources);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toBe("Pattern: no pieces for size XS, S, L, XL, 2XL, 3XL.");
    expect(sources.calls).toEqual([]);
  });

  it("stops when two print files would share one path", async () => {
    const sources = fixtureSources({ print: { files: async () => [{ panel: "front", bytes: tinyPdf("a") }, { panel: "front", bytes: tinyPdf("b") }] } });
    await expect(buildPackage(JSY_INPUT, sources)).rejects.toThrow("share the path");
  });
});

describe("buildPackage: speed", () => {
  it("builds one article in seven sizes well under 60 seconds", async () => {
    const started = performance.now();
    const { files } = await built();
    expect(files.length).toBeGreaterThan(50);
    expect(performance.now() - started).toBeLessThan(60_000);
  });
});
