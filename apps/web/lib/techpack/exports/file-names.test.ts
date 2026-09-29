import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH, contentDisposition, exportFileName } from "./file-names";

const name = (patch: Partial<Parameters<typeof exportFileName>[0]> = {}) =>
  exportFileName({ styleNumber: "KW-001", designName: "Club shirt", version: 3, format: "pdf", view: null, ...patch });

/** The characters that can end a header line or break out of a quoted value. */
const DANGEROUS = /[\r\n"';\\/]/;

describe("file names", () => {
  it("names each format from the style number, the version and the kind", () => {
    expect(name().plain).toBe("KW-001-v3-tech-pack.pdf");
    expect(name({ format: "xlsx" }).plain).toBe("KW-001-v3-tech-pack.xlsx");
    expect(name({ format: "svg", view: "front" }).plain).toBe("KW-001-v3-front.svg");
    expect(name({ format: "svg", view: "back" }).plain).toBe("KW-001-v3-back.svg");
  });

  it("uses the design name when there is no style number", () => {
    expect(name({ styleNumber: "", designName: "Club shirt" }).plain).toBe("Club-shirt-v3-tech-pack.pdf");
    expect(name({ styleNumber: "   ", designName: "Club shirt" }).plain).toBe("Club-shirt-v3-tech-pack.pdf");
  });

  it("keeps only letters, digits, hyphen and underscore, and turns anything else into a hyphen", () => {
    expect(name({ styleNumber: "a b_c.d/e" }).plain).toBe("a-b_c-d-e-v3-tech-pack.pdf");
    expect(name({ styleNumber: "--x--" }).plain).toBe("x-v3-tech-pack.pdf");
  });

  it("falls back to design when nothing usable is left", () => {
    expect(name({ styleNumber: "", designName: "" }).plain).toBe("design-v3-tech-pack.pdf");
    expect(name({ styleNumber: "日本語", designName: "" }).plain).toBe("design-v3-tech-pack.pdf");
    expect(name({ styleNumber: "///", designName: "x" }).plain).toBe("design-v3-tech-pack.pdf");
  });

  it("caps the length of the name part", () => {
    const long = name({ styleNumber: "a".repeat(500) }).plain;
    expect(long).toBe(`${"a".repeat(MAX_NAME_LENGTH)}-v3-tech-pack.pdf`);
    expect(name({ styleNumber: "é".repeat(500) }).original.length).toBeLessThan(120);
  });

  it("keeps the original words for the UTF-8 form, without control or direction marks", () => {
    const made = name({ styleNumber: "Café\r\nX‮evil\u0000/..\\y" });
    expect(made.original).not.toMatch(/[\u0000-\u001f‮]/);
    expect(made.original).not.toMatch(/[/\\:*?"<>|]/);
    expect(made.original).toContain("Café");
  });

  it("keeps no character in the original name that Windows cannot hold in a file name", () => {
    const made = name({ styleNumber: 'a:b*c?d"e<f>g|h' });
    expect(made.original).toBe("a-b-c-d-e-f-g-h-v3-tech-pack.pdf");
    expect(made.plain).toBe(made.original);
  });

  it("never lets a header-breaking character reach the plain name, whatever the input", () => {
    const hostile = ['a"b', "a;b", "a\rb", "a\nb", "a\\b", "x\r\nSet-Cookie: a=b", "'; drop", "../../etc/passwd", "a\u0000b"];
    for (const text of hostile) {
      const made = name({ styleNumber: text });
      expect(made.plain, text).not.toMatch(DANGEROUS);
      expect(made.plain, text).toMatch(/^[A-Za-z0-9_-]+-v3-tech-pack\.pdf$/);
      expect(contentDisposition(made), text).not.toMatch(/[\r\n]/);
    }
  });

  it("holds for any text at all", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), fc.string({ unit: "binary" }), (styleNumber, designName) => {
        const made = name({ styleNumber, designName });
        expect(made.plain).toMatch(/^[A-Za-z0-9_-]+-v3-tech-pack\.pdf$/);
        expect(made.plain.length).toBeLessThanOrEqual(MAX_NAME_LENGTH + "-v3-tech-pack.pdf".length);
        const header = contentDisposition(made);
        expect(header).not.toMatch(/[\r\n\u0000]/);
        expect(header.startsWith("attachment; filename=\"")).toBe(true);
        // Bytes that could be read as a second header parameter cannot appear outside the two quoted or encoded values.
        expect(["attachment; ", "attachment; ; "]).toContain(
          header.replace(/filename="[^"]*"/, "").replace(/filename\*=UTF-8''[A-Za-z0-9%._~-]*/, ""),
        );
      }),
      { numRuns: 300 },
    );
  });
});

describe("the content disposition header", () => {
  it("says attachment, with the plain name in quotes", () => {
    expect(contentDisposition(name())).toBe('attachment; filename="KW-001-v3-tech-pack.pdf"');
  });

  it("adds a UTF-8 name only when the original differs from the plain one", () => {
    const header = contentDisposition(name({ styleNumber: "Café 7" }));
    expect(header).toBe(`attachment; filename="Caf--7-v3-tech-pack.pdf"; filename*=UTF-8''Caf%C3%A9%207-v3-tech-pack.pdf`);
  });

  it("encodes the characters the UTF-8 form must not hold raw", () => {
    const header = contentDisposition(name({ styleNumber: "a'b(c)d" }));
    expect(header).toContain("a%27b%28c%29d-v3-tech-pack.pdf");
  });
});
