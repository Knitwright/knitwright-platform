import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, FILE_ID, LOGO_AND_TEXT, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { buildPrintSet } from "./build";
import { vectorLogo } from "./fixtures/assets";
import { makeEnv } from "./fixtures/env";
import { TEST_GRADED_JERSEY } from "./fixtures/graded";
import { PT_PER_MM } from "./render/pdf";
import { buildPieceScene } from "./layout/piece-scene";
import { boundsOf } from "./geometry/vec";

/**
 * Acceptance case 1 of plans/production-outputs.md, W3: the benchmark polka-dot jersey, for real (W0b's dots, W7a's
 * adapters), one file per piece per size. Every size of the graded fixture.
 */
const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS }));
const assets = [vectorLogo(FILE_ID)];

describe("case 1: polka-dot benchmark jersey, one file per piece per size", () => {
  it("makes a 1:1 PDF and an SVG for every piece of every size, with the page the piece plus 2 x 15 mm", async () => {
    const env = await makeEnv(stack, { assets });
    const set = await buildPrintSet(env, { sizes: TEST_GRADED_JERSEY.sizes, formats: ["pdf", "svg"] });
    expect(set.problems).toEqual([]);
    expect(set.files).toHaveLength(7 * 5 * 2);
    for (const file of set.files.filter((f) => f.format === "pdf")) {
      const scene = (await buildPieceScene(env, { view: file.view, size: file.size }))!;
      const b = boundsOf(scene.cutOutline);
      const doc = await pdfjs.getDocument({ data: new Uint8Array(file.bytes) }).promise;
      const [x0, y0, x1, y1] = (await doc.getPage(1)).view;
      expect(Math.abs((x1 - x0) / PT_PER_MM - (b.maxX - b.minX + 30)), file.path).toBeLessThan(0.1);
      expect(Math.abs((y1 - y0) / PT_PER_MM - (b.maxY - b.minY + 30)), file.path).toBeLessThan(0.1);
    }
    for (const file of set.files.filter((f) => f.format === "svg")) {
      const text = new TextDecoder().decode(file.bytes);
      expect(text).toContain('id="guides"');
      expect(text).not.toMatch(/<script|onload=/i);
    }
  }, 300_000);

  it("makes a 150 dpi TIFF of the right pixel size", async () => {
    const env = await makeEnv(stack, { assets });
    const set = await buildPrintSet(env, { sizes: ["44", "56"], formats: ["tiff"], views: ["front", "back", "sleeve-left", "collar"] });
    expect(set.files).toHaveLength(8);
    for (const file of set.files) {
      const scene = (await buildPieceScene(env, { view: file.view, size: file.size }))!;
      const meta = await sharp(Buffer.from(file.bytes)).metadata();
      expect(meta.density).toBe(150);
      expect(meta.width).toBe(Math.round(((scene.box.maxX - scene.box.minX) / 25.4) * 150));
      expect(meta.height).toBe(Math.round(((scene.box.maxY - scene.box.minY) / 25.4) * 150));
    }
  }, 300_000);
});
