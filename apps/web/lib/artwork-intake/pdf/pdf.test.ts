import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildPdf } from "../fixtures/pdf";
import { REFUSALS } from "../messages";
import { matte } from "./matte";
import { rasterisePdf, scaleFor } from "./rasterise";
import { scanPdf } from "./scan";

const pixelAt = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels;
  return [...data.subarray(at, at + info.channels)];
};

describe("scanPdf", () => {
  it("finds script, even when its letters are written as #xx", () => {
    expect(scanPdf(buildPdf({ openScript: "app.alert(1)" })).script).toBe(true);
    const sneaky = new TextEncoder().encode("%PDF-1.4\n<< /S /Java#53cript /J#53 (x) >>");
    expect(scanPdf(sneaky).script).toBe(true);
    expect(scanPdf(buildPdf()).script).toBe(false);
  });

  it("lists the parts that are dropped", () => {
    const found = scanPdf(buildPdf({ attachment: true, link: "https://example.com" }));
    expect(found.dropped).toEqual(["embedded files", "web links"]);
  });
});

describe("rasterisePdf", () => {
  it("draws the first page at 300 dpi with a see-through background and states the page size", async () => {
    const page = await rasterisePdf(buildPdf({ size: [200, 100] }));
    expect([page.widthPx, page.heightPx, page.dpi]).toEqual([833, 416, 300]);
    expect(page.pageSizeMm.width).toBeCloseTo((200 / 72) * 25.4, 6);
    // The red square is at 20..120 x 20..80 points from the bottom left.
    expect(await pixelAt(page.png, Math.round((100 / 72) * 300), Math.round(((100 - 30) / 72) * 300))).toEqual([255, 0, 0, 255]);
    expect((await pixelAt(page.png, 2, 2))[3]).toBe(0);
    expect(page.notes).toContain("Spot colours were turned into screen colours.");
  });

  it("uses the first page only and says so", async () => {
    const page = await rasterisePdf(buildPdf({ pages: 3 }));
    expect(page.pageCount).toBe(3);
    expect(page.notes).toContain("Only the first page of the file was used.");
  });

  it("refuses a PDF with a script, plainly written or hidden in a compressed stream", async () => {
    await expect(rasterisePdf(buildPdf({ openScript: "app.alert(1)" }))).rejects.toMatchObject({ message: REFUSALS.pdfScript });
    await expect(rasterisePdf(buildPdf({ openScript: "this.exportDataObject()", hideInStream: true }))).rejects.toMatchObject({ message: REFUSALS.pdfScript });
  });

  it("leaves out embedded files and links, and says so", async () => {
    const page = await rasterisePdf(buildPdf({ attachment: true, link: "https://example.com/x" }));
    expect(page.notes.join(" ")).toContain("The PDF contained embedded files, web links. They were left out.");
  });

  it("reads a PDF whose catalog is in a compressed stream when it has no script", async () => {
    const page = await rasterisePdf(buildPdf({ hideInStream: true }));
    expect(page.widthPx).toBeGreaterThan(0);
  });

  it("keeps the picture within the size limits for a very large page", () => {
    const small = scaleFor(200, 100);
    expect(small).toBeCloseTo(300 / 72, 9);
    const scale = scaleFor(14_400, 14_400);
    expect(14_400 * scale).toBeLessThanOrEqual(12_000);
    expect(Math.floor(14_400 * scale) ** 2).toBeLessThanOrEqual(90_000_000);
    expect(scale * 72).toBeLessThan(300);
  });

  it("refuses a file that is not a readable PDF", async () => {
    await expect(rasterisePdf(new TextEncoder().encode("%PDF-1.4\nnot really"))).rejects.toMatchObject({ message: REFUSALS.unreadable });
  });
});

describe("matte", () => {
  const flat = (rgb: readonly number[]) => sharp({ create: { width: 2, height: 1, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();

  it("gives solid colour where the two drawings agree and see-through where they follow the background", async () => {
    // Left pixel: red art. Right pixel: nothing drawn (white on white, black on black).
    const white = await sharp(Buffer.from([255, 0, 0, 255, 255, 255]), { raw: { width: 2, height: 1, channels: 3 } }).png().toBuffer();
    const black = await sharp(Buffer.from([255, 0, 0, 0, 0, 0]), { raw: { width: 2, height: 1, channels: 3 } }).png().toBuffer();
    const { data } = await sharp(await matte(white, black)).raw().toBuffer({ resolveWithObject: true });
    expect([...data]).toEqual([255, 0, 0, 255, 0, 0, 0, 0]);
  });

  it("recovers half see-through colour", async () => {
    // 50% black art: white shows 127.5, black shows 0.
    const { data } = await sharp(await matte(await flat([128, 128, 128]), await flat([0, 0, 0]))).raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBeGreaterThan(120);
    expect(data[3]).toBeLessThan(135);
  });

  it("refuses two drawings of different sizes", async () => {
    const one = await sharp({ create: { width: 2, height: 1, channels: 3, background: "#fff" } }).png().toBuffer();
    const other = await sharp({ create: { width: 3, height: 1, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(matte(one, other)).rejects.toThrow(/differ in size/);
  });
});
