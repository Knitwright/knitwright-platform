import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { designWith, madeUpValues } from "@/lib/flat/fixtures/designs";
import { AppError } from "@/lib/server/core/errors";
import { DEFAULT_PRINT_PROFILE } from "./profiles";
import { NO_RULES } from "./fixtures/setup";
import { printQuerySchema, servePrintFiles, type PrintDeps } from "./service";
import { patternFor } from "./source";

const deps = (patch: Partial<PrintDeps> = {}): PrintDeps => ({
  project: { name: "Home Kit 2027", version: 3, spec: jersey() },
  profile: DEFAULT_PRINT_PROFILE,
  rules: NO_RULES,
  icc: null,
  ...patch,
});

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

  it("refuses a garment with no pattern, a size not in the pattern, a TIFF run for every size and too many files", async () => {
    const tee = designWith("crew-tee", {}, madeUpValues({}));
    await expect(servePrintFiles(deps({ project: { name: "Tee", version: 1, spec: tee } }), query())).rejects.toMatchObject({ code: "not_found" });
    await expect(servePrintFiles(deps(), query({ size: "99" }))).rejects.toBeInstanceOf(AppError);
    await expect(servePrintFiles(deps(), query({ formats: "tiff" }))).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("only offers a pattern for jerseys, and says where it came from", () => {
    expect(patternFor("team-jersey")?.note).toMatch(/benchmark jersey/);
    expect(patternFor("crew-tee")).toBeNull();
  });
});
