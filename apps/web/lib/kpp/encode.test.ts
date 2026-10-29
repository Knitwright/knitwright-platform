import { describe, expect, it } from "vitest";
import { csv, csvCell, hexToLab, sha256Hex, stableJson, utf8 } from "./encode";
import { careLabelPath, dxfPath, nestPath, packageRoot, pdf1to1Path, printPath, safePart, svgPath } from "./paths";

describe("csvCell", () => {
  it("writes plain text as it stands and quotes what needs it", () => {
    expect(csvCell("SMITH")).toBe("SMITH");
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("line\r\nbreak")).toBe('"line\r\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(520)).toBe("520");
    expect(csvCell(true)).toBe("true");
  });

  it("makes text a spreadsheet would read as a formula plain text", () => {
    for (const start of ["=", "+", "-", "@", "\t", "\r"]) expect(csvCell(`${start}SUM(A1)`)).toContain(`'${start}SUM(A1)`);
    // A negative number is a number, not an injection: only text is prefixed.
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("csv", () => {
  it("joins rows with CRLF and ends the file with one", () => {
    expect(csv([["a", "b"], [1, null]])).toBe("a,b\r\n1,\r\n");
  });
});

describe("stableJson", () => {
  it("sorts keys at every depth, so the same data gives the same bytes", () => {
    const a = stableJson({ b: 1, a: { d: [{ f: 1, e: 2 }], c: null } });
    const b = stableJson({ a: { c: null, d: [{ e: 2, f: 1 }] }, b: 1 });
    expect(a).toBe(b);
    expect(a.endsWith("\n")).toBe(true);
    expect(a.indexOf('"a"')).toBeLessThan(a.indexOf('"b"'));
  });
});

describe("sha256Hex", () => {
  it("is the hash of the bytes", () => {
    expect(sha256Hex(utf8("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("hexToLab", () => {
  it("gives the screen colour's Lab to one decimal, with no negative zero", () => {
    expect(hexToLab("#ffffff")).toEqual([100, 0, 0]);
    expect(hexToLab("#000000")).toEqual([0, 0, 0]);
    // The navy of docs/spec/04's colour_spec.json example. That file shows [12.9, 4.1, -27.6],
    // which is not the D65 two-degree sRGB Lab of #0B1F4B; the spec calls its numbers
    // illustrative, and this one is computed, so the two differ. An owner question in the
    // decision record asks which white point the factory's colour house works to.
    expect(hexToLab("#0B1F4B")).toEqual([13, 10.7, -29.6]);
  });

  it("refuses what is not a colour", () => {
    expect(() => hexToLab("navy")).toThrow();
  });
});

describe("safePart", () => {
  it("keeps letters, digits, dot, hyphen and underscore and drops the rest", () => {
    expect(safePart("JSY-SS-01")).toBe("JSY-SS-01");
    expect(safePart("Acme FC / Home kit")).toBe("Acme_FC_Home_kit");
  });

  it("cannot make a path that escapes the package", () => {
    for (const hostile of ["../../etc/passwd", "..", ".hidden", "a/../b", "\\\\server\\share", "a\0b"]) {
      const part = safePart(hostile);
      expect(part, hostile).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
      expect(part, hostile).not.toContain("..");
    }
    expect(safePart("..")).toBe("x");
    expect(safePart(".hidden")).toBe("hidden");
  });

  it("falls back when nothing safe is left, and caps the length", () => {
    expect(safePart("", "design")).toBe("design");
    expect(safePart("名前", "design")).toBe("design");
    expect(safePart("a".repeat(200))).toHaveLength(60);
  });
});

describe("the paths of docs/spec/04", () => {
  it("names the package root and every pattern file", () => {
    expect(packageRoot("ACME Home Kit", 3, "SKT-01")).toBe("KPP_ACME_Home_Kit_v3_SKT-01");
    expect(dxfPath("JSY-SS-01", "2XL")).toBe("03_patterns/dxf_aama/JSY-SS-01_2XL.dxf");
    expect(nestPath("JSY-SS-01")).toBe("03_patterns/dxf_aama/JSY-SS-01_nest.dxf");
    expect(pdf1to1Path("JSY-SS-01", "M")).toBe("03_patterns/pdf_1to1/JSY-SS-01_M.pdf");
    expect(svgPath("JSY-SS-01", "M")).toBe("03_patterns/svg/JSY-SS-01_M.svg");
    expect(careLabelPath("UK")).toBe("07_labels/care_label_uk.pdf");
  });

  it("names a sample print file by size and a batch print file by order and size", () => {
    expect(printPath("JSY-SS-01", "back", "XL", "pdf", null)).toBe("04_print/XL/SAMPLE_JSY-SS-01_back_XL.pdf");
    expect(printPath("JSY-SS-01", "back", "XL", "pdf", "KW10422")).toBe("04_print/KW10422/XL/KW10422_JSY-SS-01_back_XL.pdf");
    expect(printPath("JSY-SS-01", "back", "XL", "tif", null)).toBe("04_print/XL/SAMPLE_JSY-SS-01_back_XL.tif");
  });

  it("cannot be talked into a path outside the folder it names", () => {
    for (const path of [printPath("../a", "../b", "../c", "pdf", "../d"), dxfPath("../a", "../b"), careLabelPath("../x")]) {
      expect(path).not.toContain("..");
      expect(path.split("/").every((part) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))).toBe(true);
    }
    expect(printPath("../a", "../b", "../c", "pdf", "../d").startsWith("04_print/")).toBe(true);
  });
});
