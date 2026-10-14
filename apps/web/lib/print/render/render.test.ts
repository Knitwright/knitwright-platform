import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { makeEnv, testFont } from "../fixtures/env";
import { buildPieceScene } from "../layout/piece-scene";
import { EXTENSION_OF, MIME_OF, renderFile } from "./files";
import { PT_PER_MM } from "./pdf";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS }));

async function sceneAndEnv(view: "front" | "back" | "collar" = "front", size = "48") {
  const env = await makeEnv(stack);
  const scene = (await buildPieceScene(env, { view, size }))!;
  return { env, scene, render: { font: await testFont(), settings: env.settings } };
}

describe("rendering a piece", () => {
  it("makes a PDF whose first page is the piece plus 2 x 15 mm, to 0.1 mm", async () => {
    const { scene, render } = await sceneAndEnv("front", "48");
    const file = await renderFile(scene, "pdf", render);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(file.bytes) }).promise;
    const page = await doc.getPage(1);
    const [x0, y0, x1, y1] = page.view;
    const xs = scene.cutOutline.map((p) => p[0]);
    const ys = scene.cutOutline.map((p) => p[1]);
    expect(Math.abs((x1 - x0) / PT_PER_MM - (Math.max(...xs) - Math.min(...xs) + 30))).toBeLessThan(0.1);
    expect(Math.abs((y1 - y0) / PT_PER_MM - (Math.max(...ys) - Math.min(...ys) + 30))).toBeLessThan(0.1);
    expect(doc.numPages).toBe(2);
    expect(file.pageWidthMm).toBeCloseTo((x1 - x0) / PT_PER_MM, 1);
  });
  it("keeps vector artwork as paths in the PDF, with no picture", async () => {
    const { scene, render } = await sceneAndEnv("back", "50");
    const doc = await pdfjs.getDocument({ data: new Uint8Array((await renderFile(scene, "pdf", render)).bytes) }).promise;
    const ops = await (await doc.getPage(1)).getOperatorList();
    const names = Object.fromEntries(Object.entries(pdfjs.OPS).map(([k, v]) => [v, k]));
    const used = new Set(ops.fnArray.map((f) => names[f]));
    expect(used.has("constructPath")).toBe(true);
    expect([...used].some((n) => /Image/.test(n))).toBe(false);
  });
  it("makes an SVG in millimetres with the guides and notes, and no script", async () => {
    const { scene, render } = await sceneAndEnv();
    const text = new TextDecoder().decode((await renderFile(scene, "svg", render)).bytes);
    expect(text).toMatch(/^<svg [^>]*width="\d+(\.\d+)?mm"/);
    expect(text).toContain('id="guides"');
    expect(text).toContain('id="notes"');
    expect(text).toContain("Draft pattern, not reviewed.");
    expect(text).not.toMatch(/<script|onload|javascript:|<foreignObject|xlink:href="http/i);
  });
  it("makes a TIFF at 150 dpi of the right pixel size", async () => {
    const { scene, render } = await sceneAndEnv("collar", "48");
    const file = await renderFile(scene, "tiff", render);
    const meta = await sharp(Buffer.from(file.bytes)).metadata();
    expect(meta.format).toBe("tiff");
    expect(meta.density).toBe(150);
    const px = (mm: number): number => Math.round((mm / 25.4) * 150);
    expect(meta.width).toBe(px(scene.box.maxX - scene.box.minX));
    expect(meta.height).toBe(px(scene.box.maxY - scene.box.minY));
  });
  it("builds a TIFF in strips that equals a TIFF in one piece", async () => {
    const { scene, render } = await sceneAndEnv("collar", "48");
    const whole = await renderFile(scene, "tiff", render);
    const strips = await renderFile(scene, "tiff", { ...render, stripBudget: 20_000 });
    const [a, b] = await Promise.all([sharp(Buffer.from(whole.bytes)).raw().toBuffer(), sharp(Buffer.from(strips.bytes)).raw().toBuffer()]);
    // Edges are drawn per strip, so thin edges are anti-aliased per strip, so a few percent of pixels may differ by more than a shade.
    expect(a.length).toBe(b.length);
    let off = 0;
    for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > 8) off += 1;
    expect(off / a.length).toBeLessThan(0.03);
  });
  it("gives the same bytes twice in every format", async () => {
    for (const format of ["pdf", "svg", "tiff"] as const) {
      const { scene, render } = await sceneAndEnv("collar", "48");
      const [a, b] = [await renderFile(scene, format, render), await renderFile(scene, format, render)];
      expect(a.sha256, format).toBe(b.sha256);
    }
  });
  it("names each format's type and extension", () => {
    expect(MIME_OF.tiff).toBe("image/tiff");
    expect(EXTENSION_OF.tiff).toBe("tif");
  });
});
