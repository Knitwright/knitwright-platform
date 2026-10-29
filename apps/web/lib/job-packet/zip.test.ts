import { createHash } from "node:crypto";
import { unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { NO_PATTERNS_NOTE } from "./patterns";
import { jobZip, readme } from "./zip";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const read = (zip: Uint8Array) => unzipSync(zip);
const text = (value: Uint8Array | undefined): string => new TextDecoder().decode(value);
const sha = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");

const printZip = zipSync({
  "STORE-1/front.png": bytes("front"),
  "STORE-1/back.png": bytes("back"),
  "manifest.csv": bytes("order,file\nSTORE-1,front.png\n"),
});

const input = { sheet: bytes("%PDF-1.7 sheet"), printZip, patterns: [], patternNote: NO_PATTERNS_NOTE };

describe("readme", () => {
  it("names each folder in plain words and tells the factory not to print past the manifest", () => {
    const lines = readme(null);

    expect(lines).toContain("job_sheet.pdf");
    expect(lines).toContain("print/");
    expect(lines).toContain("patterns/: the pattern files for each order and size.");
    expect(lines).toContain("Do not print a line the manifest says differs from the release");
    expect(lines.split("\r\n").length).toBeGreaterThan(4);
  });

  it("says why there are no patterns when the source adds none", () => {
    expect(readme(NO_PATTERNS_NOTE)).toContain(NO_PATTERNS_NOTE);
    expect(readme(NO_PATTERNS_NOTE)).not.toContain("patterns/: the pattern files");
  });
});

describe("jobZip", () => {
  it("holds the README, the job sheet and the batch's print files with their manifest", () => {
    const files = read(jobZip(input));

    expect(Object.keys(files).sort()).toEqual(["README.txt", "job_sheet.pdf", "print/STORE-1/back.png", "print/STORE-1/front.png", "print/manifest.csv"]);
    expect(text(files["job_sheet.pdf"])).toBe("%PDF-1.7 sheet");
    expect(text(files["print/manifest.csv"])).toContain("STORE-1,front.png");
    expect(text(files["README.txt"])).toContain(NO_PATTERNS_NOTE);
  });

  it("puts the pattern files the source gives under patterns/, in a fixed order", () => {
    const files = read(
      jobZip({
        ...input,
        patternNote: null,
        patterns: [
          { path: "STORE-2/dxf_aama/M.dxf", bytes: bytes("m") },
          { path: "STORE-1/dxf_aama/L.dxf", bytes: bytes("l") },
        ],
      }),
    );

    expect(Object.keys(files).filter((name) => name.startsWith("patterns/"))).toEqual(["patterns/STORE-1/dxf_aama/L.dxf", "patterns/STORE-2/dxf_aama/M.dxf"]);
  });

  it("gives the same bytes twice for the same inputs, because it carries no clock", () => {
    expect(sha(jobZip(input))).toBe(sha(jobZip(input)));
  });

  it("gives different bytes once a file inside changes", () => {
    expect(sha(jobZip(input))).not.toBe(sha(jobZip({ ...input, sheet: bytes("%PDF-1.7 other") })));
  });

  it("keeps every path inside the ZIP's own folders, whatever a name tried to be", () => {
    const files = read(
      jobZip({
        ...input,
        patternNote: null,
        patterns: [
          { path: "../../etc/passwd", bytes: bytes("x") },
          { path: "/absolute/M.dxf", bytes: bytes("y") },
          { path: "a/../../b.dxf", bytes: bytes("z") },
          { path: "", bytes: bytes("w") },
        ],
      }),
    );
    const paths = Object.keys(files).filter((name) => name.startsWith("patterns/"));

    expect(paths).toEqual(["patterns/file", "patterns/_/_/etc/passwd", "patterns/absolute/M.dxf", "patterns/a/_/_/b.dxf"]);
    for (const path of paths) {
      expect(path).not.toContain("..");
      expect(path.startsWith("patterns/")).toBe(true);
    }
  });

  it("keeps a print file's own path inside print/, whatever the builder named it", () => {
    const files = read(jobZip({ ...input, printZip: zipSync({ "../escape.png": bytes("x") }) }));

    expect(Object.keys(files)).toContain("print/_/escape.png");
  });
});

describe("jobZip with two pattern files of the same path", () => {
  it("keeps one of them rather than failing, and still gives the same bytes twice", () => {
    const twice = {
      ...input,
      patternNote: null,
      patterns: [
        { path: "STORE-1/M.dxf", bytes: bytes("one") },
        { path: "STORE-1/M.dxf", bytes: bytes("two") },
      ],
    };

    const files = read(jobZip(twice));

    expect(Object.keys(files).filter((n) => n.startsWith("patterns/"))).toEqual(["patterns/STORE-1/M.dxf"]);
    expect(sha(jobZip(twice))).toBe(sha(jobZip(twice)));
  });
});
