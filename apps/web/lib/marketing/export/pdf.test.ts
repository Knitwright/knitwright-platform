import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pageImage } from "./render";
import { pageSize, renderMarketingPdf } from "./pdf";
import { place } from "../layout";
import { buildLayouts } from "../templates/plans";
import { layoutSvg } from "./svg";

/**
 * This file makes PDFs, so it runs in the "pdf" project of `vitest.config.mts`, one file at a time
 * after the rest, as every other PDF test does.
 */

const SIZE = { width: 200, height: 250 };

const drawing = (): string =>
  layoutSvg({
    size: SIZE,
    slots: place(buildLayouts().find((one) => one.key === "a4-poster")!.slots, SIZE),
    fills: new Map([["headline", { kind: "words", text: "New kit" }]]),
    pictures: new Map(),
    colours: { background: "#ffffff", primary: "#111111" },
    withBackground: true,
    watermark: null,
  });

const png = (watermark = false): Promise<Uint8Array> =>
  pageImage({ drawing: drawing(), size: SIZE, format: "pdf", colourSpace: "rgb", watermark, profile: null, withBackground: true });

describe("the page a PDF is", () => {
  it("is the artboard's own physical size in points, whatever the resolution", () => {
    // A4 at 300 dots per inch is 2480 x 3508 px, which is an A4 page: 595.28 x 841.89 pt.
    expect(pageSize({ width: 2480, height: 3508 }, 300)).toEqual({ width: 595.2, height: 841.92 });
    expect(pageSize({ width: 595, height: 842 }, 72)).toEqual({ width: 595, height: 842 });
  });
});

describe("the PDF of one artboard", () => {
  it("is a one-page PDF with the artboard drawn on it", async () => {
    const bytes = await renderMarketingPdf({ png: await png(), size: SIZE, dpi: 72, title: "New kit", profile: null });
    const head = new TextDecoder().decode(bytes.slice(0, 8));

    expect(head.startsWith("%PDF-")).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("gives the same bytes for the same artboard, because its clock is fixed", async () => {
    const picture = await png();
    const made = () => renderMarketingPdf({ png: picture, size: SIZE, dpi: 72, title: "New kit", profile: null });
    const [first, second] = await Promise.all([made(), made()]);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("carries the mark when the plan asks for one, because the picture already does", async () => {
    const marked = await renderMarketingPdf({ png: await png(true), size: SIZE, dpi: 72, title: "New kit", profile: null });
    const clean = await renderMarketingPdf({ png: await png(false), size: SIZE, dpi: 72, title: "New kit", profile: null });

    expect(marked.byteLength).not.toBe(clean.byteLength);
  });

  it("says in the file which profile a separation was made against, or that it is RGB", async () => {
    const picture = await png();
    const rgb = await renderMarketingPdf({ png: picture, size: SIZE, dpi: 72, title: "New kit", profile: null });
    const cmyk = await renderMarketingPdf({ png: picture, size: SIZE, dpi: 72, title: "New kit", profile: { name: "A profile", fileId: "f" } });

    expect(new TextDecoder("latin1").decode(rgb)).toContain("RGB");
    expect(new TextDecoder("latin1").decode(cmyk)).toContain("Separated against A profile");
  });

  it("draws the picture the platform made, at the size it was made at", async () => {
    const meta = await sharp(Buffer.from(await png())).metadata();
    expect([meta.width, meta.height]).toEqual([SIZE.width, SIZE.height]);
  });
});
