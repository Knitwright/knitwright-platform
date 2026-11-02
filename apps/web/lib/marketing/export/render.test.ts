import { unzipSync } from "fflate";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { WATERMARK_TEXT, watermarkSvg } from "@/lib/media/watermark";
import { place } from "../layout";
import { buildLayouts } from "../templates/plans";
import { renderBytes, pageImage, type RenderInput } from "./render";
import { layoutSvg } from "./svg";
import { zipExports, folderOf, zipName, type ExportedFile } from "./zip";

/** Small on purpose: this is the pipeline being tested, not a poster. */
const SIZE = { width: 200, height: 250 };

const drawing = (withBackground = true, watermark: string | null = null): string =>
  layoutSvg({
    size: SIZE,
    slots: place(buildLayouts().find((one) => one.key === "new-kit-reveal")!.slots, SIZE),
    fills: new Map([["headline", { kind: "words", text: "New kit" }]]),
    pictures: new Map(),
    colours: { background: "#1b2a49", primary: "#ffffff" },
    withBackground,
    watermark,
  });

const input = (over: Partial<RenderInput> = {}): RenderInput => ({
  drawing: drawing(),
  size: SIZE,
  format: "png",
  colourSpace: "rgb",
  watermark: false,
  profile: null,
  withBackground: true,
  ...over,
});

describe("making the bytes", () => {
  it("makes a PNG at the artboard's own size", async () => {
    const bytes = await renderBytes(input());
    const meta = await sharp(Buffer.from(bytes)).metadata();

    expect(meta.format).toBe("png");
    expect([meta.width, meta.height]).toEqual([200, 250]);
  });

  it("keeps the transparency when the background was left out", async () => {
    const clear = await sharp(Buffer.from(await renderBytes(input({ drawing: drawing(false) })))).stats();
    const solid = await sharp(Buffer.from(await renderBytes(input()))).stats();

    expect(clear.isOpaque).toBe(false);
    expect(solid.isOpaque).toBe(true);
  });

  it("makes a JPEG, which has no transparency, by filling the background", async () => {
    const bytes = await renderBytes(input({ format: "jpeg", drawing: drawing(false) }));
    const meta = await sharp(Buffer.from(bytes)).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.hasAlpha).toBe(false);
  });

  it("writes the SVG itself when that is what was asked for", async () => {
    const bytes = await renderBytes(input({ format: "svg" }));
    expect(new TextDecoder().decode(bytes).startsWith("<svg")).toBe(true);
  });

  it("puts the platform's own mark over the pixels when the plan says so", async () => {
    const marked = await renderBytes(input({ watermark: true }));
    const clean = await renderBytes(input());

    expect(marked.byteLength).not.toBe(clean.byteLength);
    // The mark is the platform's: its own words, from lib/media/watermark.ts.
    expect(watermarkSvg(SIZE.width, SIZE.height)).toContain(WATERMARK_TEXT);
  });

  it("refuses CMYK with no profile on file rather than making something wrong", async () => {
    await expect(renderBytes(input({ format: "jpeg", colourSpace: "cmyk" }))).rejects.toThrow(/No colour profile is on file/);
  });

  it("separates a JPEG when a profile is on file", async () => {
    const bytes = await renderBytes(input({ format: "jpeg", colourSpace: "cmyk", profile: { name: "A profile", fileId: "f" } }));
    const meta = await sharp(Buffer.from(bytes)).metadata();

    expect(meta.space).toBe("cmyk");
    expect(meta.channels).toBe(4);
  });

  it("sends a PDF somewhere else, so this module holds no PDF writer", async () => {
    await expect(renderBytes(input({ format: "pdf" }))).rejects.toThrow(/renderMarketingPdf/);
  });

  it("makes the picture a PDF page is drawn from, always RGB", async () => {
    const meta = await sharp(Buffer.from(await pageImage(input({ format: "pdf", colourSpace: "cmyk" })))).metadata();
    expect(meta.format).toBe("png");
    expect(meta.space).toBe("srgb");
  });

  it("gives the same bytes for the same artboard, every time", async () => {
    const [first, second] = await Promise.all([renderBytes(input()), renderBytes(input())]);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });
});

describe("several artboards as one zip", () => {
  const file = (name: string, format: ExportedFile["format"]): ExportedFile => ({ name, format, bytes: new Uint8Array([1, 2, 3]) });

  /** The files in a zip, leaving out the folder entries a zip also carries. */
  const namesIn = (zip: Uint8Array): string[] =>
    Object.keys(unzipSync(zip))
      .filter((name) => !name.endsWith("/"))
      .sort();

  it("puts a folder per format, as the spec asks", () => {
    expect(namesIn(zipExports([file("a.png", "png"), file("b.pdf", "pdf"), file("c.svg", "svg")]))).toEqual(["pdf/b.pdf", "png/a.png", "svg/c.svg"]);
  });

  it("numbers a name used twice in one folder", () => {
    expect(namesIn(zipExports([file("a.png", "png"), file("a.png", "png"), file("a.png", "png")]))).toEqual(["png/a-2.png", "png/a-3.png", "png/a.png"]);
  });

  it("names each folder after its format", () => {
    expect([folderOf("png"), folderOf("jpeg"), folderOf("svg"), folderOf("pdf")]).toEqual(["png", "jpeg", "svg", "pdf"]);
  });

  it("gives the zip a name from the project, with no date in it", () => {
    expect(zipName("Harrow Town 25/26 launch")).toBe("harrow-town-25-26-launch-exports.zip");
    expect(zipName("")).toBe("launch-exports.zip");
  });

  it("gives the same zip for the same files, because the date in it is fixed", () => {
    const first = zipExports([file("a.png", "png")]);
    const second = zipExports([file("a.png", "png")]);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });
});
