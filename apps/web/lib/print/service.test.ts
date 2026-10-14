import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { AppError } from "@/lib/server/core/errors";
import { createFakeAssetReader, writeStack } from "@/lib/artwork-stack";
import { DEFAULT_PRINT_PROFILE } from "./profiles";
import { gradedJersey } from "./fixtures/graded";
import { NO_RULES } from "./fixtures/setup";
import { polkaStack } from "./fixtures/stacks";
import { printQuerySchema, servePrintFiles, type PrintDeps } from "./service";

const NOTE = "Pattern: Team jersey, version 3. Draft pattern, not reviewed.";

const deps = (patch: Partial<PrintDeps> = {}): PrintDeps => ({
  project: { name: "Home Kit 2027", version: 3, spec: jersey() },
  pattern: { ok: true, pattern: gradedJersey(["48"]), reviewed: false, note: NOTE },
  context: { profile: DEFAULT_PRINT_PROFILE, icc: null, rules: NO_RULES, assets: createFakeAssetReader([]) },
  roster: null,
  ...patch,
});

/** The home kit with names and numbers on it, so a player has files of their own. */
const withMarks = (): PrintDeps["project"] => ({ name: "Home Kit 2027", version: 3, spec: writeStack(jersey(), polkaStack(), 3) });

const query = (input: Record<string, string> = {}) => printQuerySchema.parse(input);

describe("print query", () => {
  it("defaults to PDF and SVG and reads a list of formats once each", () => {
    expect(query().formats).toEqual(["pdf", "svg"]);
    expect(query({ formats: "svg, pdf,svg" }).formats).toEqual(["svg", "pdf"]);
    expect(() => printQuerySchema.parse({ formats: "exe" })).toThrow();
    expect(() => printQuerySchema.parse({ formats: "" })).toThrow();
  });
});

describe("servePrintFiles", () => {
  it("sends a zip of every piece with a manifest and a read-me, and nothing else", async () => {
    const response = await servePrintFiles(deps(), query({ formats: "svg" }));
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="home-kit-2027-v3-print-files.zip"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(
      ["48/back.svg", "48/collar.svg", "48/front.svg", "48/sleeve-left.svg", "48/sleeve-right.svg", "manifest.csv", "read-me.txt"].sort(),
    );
    expect(new TextDecoder().decode(files["48/front.svg"]!)).toContain("Draft pattern, not reviewed.");
    expect(new TextDecoder().decode(files["48/front.svg"]!)).toContain("Knitwright defaults");
  }, 60_000);

  it("says in the read-me which pattern the files are cut from", async () => {
    const response = await servePrintFiles(deps(), query({ formats: "svg", size: "48" }));
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(new TextDecoder().decode(files["read-me.txt"]!)).toContain(NOTE);
  }, 60_000);

  it("makes a set for every player in the team list, and says which players it could not make one for", async () => {
    const rows = [{ ...ROSTER_22.rows[0]!, sizeLabel: "48" }, { ...ROSTER_22.rows[1]!, sizeLabel: "ZZ" }];
    const response = await servePrintFiles(deps({ project: withMarks(), roster: { rows } }), query({ formats: "svg", size: "48" }));
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const mine = Object.keys(files).filter((name) => name.includes(rows[0]!.number));
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(new TextDecoder().decode(files["read-me.txt"]!)).toContain("has no pattern size");
  }, 60_000);

  it("refuses a size not in the pattern, a TIFF run for every size and too many files", async () => {
    await expect(servePrintFiles(deps(), query({ size: "99" }))).rejects.toBeInstanceOf(AppError);
    await expect(servePrintFiles(deps(), query({ formats: "tiff" }))).rejects.toMatchObject({ code: "invalid_input" });
    const many = { ...ROSTER_22, rows: Array.from({ length: 400 }, (_, at) => ({ ...ROSTER_22.rows[0]!, number: String(at % 100), sizeLabel: "48" })) };
    await expect(servePrintFiles(deps({ project: withMarks(), roster: many }), query())).rejects.toMatchObject({ code: "invalid_input", message: expect.stringContaining("more than") });
  });
});
