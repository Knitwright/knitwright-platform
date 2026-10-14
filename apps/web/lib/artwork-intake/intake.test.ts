import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildPdf } from "./fixtures/pdf";
import { cmykTiff } from "./fixtures/cmyk-tiff";
import { logoOnWhite, solidPng } from "./fixtures/pictures";
import { intakeArtwork } from "./intake";
import { REFUSALS, SVG_REFUSALS } from "./messages";

const text = (value: string) => new TextEncoder().encode(value);
const CLEAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="90mm" height="45mm"><path d="M0 0H100V50H0Z" fill="#c8102e"/></svg>';

describe("intakeArtwork: what a file is", () => {
  it("decides by the first bytes, not the name: a PNG named .svg is a PNG", async () => {
    const result = await intakeArtwork(await solidPng(20, 10, "#2b46f0"), "pretend.svg");
    expect([result.kind, result.sourceFormat]).toEqual(["raster", "png"]);
  });

  it("refuses a script saved under a picture name, and an HTML page", async () => {
    await expect(intakeArtwork(text("<html><script>alert(1)</script></html>"), "logo.png")).rejects.toMatchObject({ message: REFUSALS.notAccepted });
    await expect(intakeArtwork(text("<svg><script>alert(1)</script></svg>"), "logo.png")).rejects.toMatchObject({ message: SVG_REFUSALS.script });
  });

  it("refuses a native Illustrator file with advice, and an unknown file", async () => {
    await expect(intakeArtwork(text("%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator"), "crest.ai")).rejects.toMatchObject({
      message: expect.stringContaining("Create PDF compatible file"),
    });
    await expect(intakeArtwork(new Uint8Array(0), "x.png")).rejects.toMatchObject({ message: REFUSALS.notAccepted });
  });

  it("refuses a file over 50 MB before reading it", async () => {
    await expect(intakeArtwork(new Uint8Array(50 * 1024 * 1024 + 1), "big.png")).rejects.toMatchObject({ code: "too_large" });
  });
});

describe("intakeArtwork: raster", () => {
  it("makes the print and screen copies of a 600 dpi CMYK TIFF, with the profile and dpi recorded", async () => {
    const result = await intakeArtwork(cmykTiff({ width: 60, height: 30, pixel: [0, 255, 255, 0], dpi: 600 }), "Home kit.tif");
    expect(result).toMatchObject({ kind: "raster", sourceFormat: "tiff", label: "Home kit", colourSpace: "cmyk", dpiMeta: 600, widthPx: 60 });
    expect(result.print?.contentType).toBe("image/tiff");
    expect(result.vector).toBeNull();
    expect((await sharp(result.print!.bytes).metadata()).space).toBe("srgb");
    expect(result.screen.contentType).toBe("image/jpeg");
  });

  it("hashes the source and the print copy", async () => {
    const png = await logoOnWhite();
    const result = await intakeArtwork(png, "crest.png");
    expect(result.sourceSha256).toBe(createHash("sha256").update(png).digest("hex"));
    expect(result.printSha256).toBe(createHash("sha256").update(result.print!.bytes).digest("hex"));
    expect(result.whiteBackground).toBe(true);
    expect(result.warnings.join(" ")).toContain("white ink");
  });
});

describe("intakeArtwork: SVG", () => {
  it("stores a clean logo as JSON with a screen picture, and no SVG anywhere in the result", async () => {
    const result = await intakeArtwork(text(CLEAN_SVG), "crest.svg");
    expect(result).toMatchObject({ kind: "vector", sourceFormat: "svg", print: null, hasAlpha: true });
    expect(result.vector?.contentType).toBe("application/json");
    expect(JSON.parse(result.vector!.bytes.toString("utf8")).schemaVersion).toBe(1);
    expect(result.statedSizeMm?.width).toBeCloseTo(90, 6);
    for (const copy of [result.vector!, result.screen]) {
      expect(copy.contentType).not.toContain("svg");
      expect(copy.bytes.includes(Buffer.from("<svg"))).toBe(false);
    }
    expect((await sharp(result.screen.bytes).metadata()).format).toBe("png");
  });

  it("is the same twice", async () => {
    const a = await intakeArtwork(text(CLEAN_SVG), "crest.svg");
    const b = await intakeArtwork(text(CLEAN_SVG), "crest.svg");
    expect([a.printSha256, a.sourceSha256]).toEqual([b.printSha256, b.sourceSha256]);
  });
});

describe("intakeArtwork: PDF and AI", () => {
  it("draws the first page, stating the page size, with the dpi it was drawn at", async () => {
    const result = await intakeArtwork(buildPdf({ size: [200, 100] }), "sponsor.pdf");
    expect(result).toMatchObject({ kind: "raster", sourceFormat: "pdf", dpiMeta: 300, hasAlpha: true });
    expect(result.statedSizeMm?.width).toBeCloseTo((200 / 72) * 25.4, 6);
    expect(result.warnings[0]).toBe("This PDF page was turned into a picture at 300 dpi.");
  });

  it("treats an AI file saved with PDF compatibility as a PDF", async () => {
    const result = await intakeArtwork(buildPdf(), "crest.AI");
    expect(result.sourceFormat).toBe("ai");
    expect(result.warnings[0]).toBe("This Illustrator page was turned into a picture at 300 dpi.");
  });

  it("refuses a PDF with a script", async () => {
    await expect(intakeArtwork(buildPdf({ openScript: "app.alert(1)" }), "x.pdf")).rejects.toMatchObject({ message: REFUSALS.pdfScript });
  });
});
