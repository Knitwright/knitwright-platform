import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildPieceScene } from "./layout/piece-scene";
import { FIDUCIALS, testCard } from "./fixtures/assets";
import { darkCentroid } from "./fixtures/probe";
import { makeEnv } from "./fixtures/env";
import { panelStack } from "./fixtures/stacks";
import { boundsOf, pointInPolygon, type Pt } from "./geometry/vec";
import { createPrintSpace, NO_SCALE } from "./layout/print-space";
import { renderFile } from "./render/files";
import { DEFAULT_SETTINGS } from "./layout/context";
import type { RasterLayer } from "./layout/scene";
import { testFont } from "./fixtures/env";

/**
 * Acceptance case 2 (fake): a 6000 x 8000 px test card with fiducial marks as the front and back panel art. The asset
 * reader is a stand-in for the artwork intake (W7b); phase B runs this on the real one.
 */
describe("case 2: a full-panel raster from the club (fake intake)", () => {
  it("lands its fiducials within 1 mm of where they belong, in every size, and continues the art into the bleed", async () => {
    const card = await testCard(6000, 8000);
    for (const size of ["44", "50", "56"]) {
      const env = await makeEnv(panelStack("card"), { assets: [card] });
      for (const view of ["front", "back"] as const) {
        const scene = (await buildPieceScene(env, { view, size }))!;
        const layer = scene.layers.find((l): l is RasterLayer => l.kind === "raster")!;
        const space = createPrintSpace(env.mapper, view, size, NO_SCALE)!;
        const plane = scene.bleedOutline.map(space.toPlane);
        const box = boundsOf(plane.map((p): Pt => [p.x, p.y]));
        const [bw, bh] = [box.maxX - box.minX, box.maxY - box.minY];
        // Cover: the picture fills the page box, keeping its shape, centred.
        const k = Math.max(bw / ((6000 / 96) * 25.4), bh / ((8000 / 96) * 25.4));
        const [w, h] = [(6000 / 96) * 25.4 * k, (8000 / 96) * 25.4 * k];
        const centre = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
        let checked = 0;
        for (const [u, v] of FIDUCIALS) {
          const expected = space.toPrint({ x: centre.x + (u - 0.5) * w, y: centre.y + (v - 0.5) * h });
          // Only a mark whose whole square (about 26 mm) is on the piece: the outline cuts the others.
          const square = [[-15, -15], [15, -15], [15, 15], [-15, 15]].map(([dx, dy]) => space.toPrint({ x: centre.x + (u - 0.5) * w + dx, y: centre.y + (v - 0.5) * h + dy }));
          if (!square.every((corner) => pointInPolygon(corner, scene.cutOutline))) continue;
          const found = await darkCentroid(layer, expected, 30);
          expect(found, `${view} ${size} fiducial ${u},${v}`).not.toBeNull();
          expect(Math.hypot(found![0] - expected[0], found![1] - expected[1])).toBeLessThan(1);
          checked += 1;
        }
        expect(checked).toBeGreaterThan(0);
        // The art reaches the bleed line: a point 1 mm inside the bleed outline's edge is covered.
        const edge = scene.bleedOutline[Math.floor(scene.bleedOutline.length / 4)];
        const inwardFromEdge = await darkOrGrey(layer, edge);
        expect(inwardFromEdge).toBe(true);
        expect(scene.lowestDpi).toBeGreaterThan(150);
        expect(scene.issues.filter((i) => i.code === "below-min-dpi")).toEqual([]);
      }
    }
  }, 300_000);

  it("warns, in the margin and in the result, when the picture is too small for the size it is printed", async () => {
    const small = await testCard(600, 800);
    const env = await makeEnv(panelStack("card"), { assets: [small] });
    const scene = (await buildPieceScene(env, { view: "front", size: "48" }))!;
    expect(scene.lowestDpi).toBeLessThan(60);
    const issue = scene.issues.find((i) => i.code === "below-min-dpi")!;
    expect(issue.text).toMatch(/about \d+ dpi at this size/);
    expect(issue.text).toMatch(/asks for 150 or more/);
    expect(scene.notes.some((n) => n.includes("may look soft"))).toBe(true);
    const file = await renderFile(scene, "svg", { font: await testFont(), settings: env.settings });
    expect(file.warnings.some((w) => /may look soft/.test(w))).toBe(true);
    expect(new TextDecoder().decode(file.bytes)).toContain("may look soft");
  }, 120_000);

  it("embeds the print house's colour profile when one is set", async () => {
    const profile = (await sharp({ create: { width: 2, height: 2, channels: 3, background: "#808080" } }).withIccProfile("p3").png().toBuffer().then((b) => sharp(b).metadata())).icc!;
    const small = await testCard(1200, 1600);
    const env = await makeEnv(panelStack("card"), {
      assets: [small],
      overrides: { settings: { ...DEFAULT_SETTINGS, iccBytes: new Uint8Array(profile), iccName: "Test P3" } },
    });
    const scene = (await buildPieceScene(env, { view: "front", size: "48" }))!;
    expect(scene.notes.some((n) => n.includes("Colour profile embedded: Test P3"))).toBe(true);
    const tiff = await renderFile(scene, "tiff", { font: env.font, settings: env.settings });
    const embedded = (await sharp(Buffer.from(tiff.bytes)).metadata()).icc!;
    expect(embedded).toBeDefined();
    const without = await makeEnv(panelStack("card"), { assets: [small] });
    const plain = await renderFile((await buildPieceScene(without, { view: "front", size: "48" }))!, "tiff", { font: without.font, settings: without.settings });
    // With no print house profile the file carries the plain sRGB profile, which is what the margin says.
    expect(Buffer.compare((await sharp(Buffer.from(plain.bytes)).metadata()).icc ?? Buffer.alloc(0), embedded)).not.toBe(0);
  }, 120_000);
});

/** True when the layer has an opaque pixel within 3 mm of the point. */
async function darkOrGrey(layer: RasterLayer, near: Pt): Promise<boolean> {
  for (const strip of layer.strips) {
    if (near[1] > strip.box.maxY + 3 || near[1] < strip.box.minY - 3) continue;
    const { data, info } = await sharp(Buffer.from(strip.png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const [mmX, mmY] = [(strip.box.maxX - strip.box.minX) / info.width, (strip.box.maxY - strip.box.minY) / info.height];
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const [px, py] = [strip.box.minX + x * mmX, strip.box.maxY - y * mmY];
        if (Math.hypot(px - near[0], py - near[1]) < 3 && data[(y * info.width + x) * 4 + 3] > 200) return true;
      }
    }
  }
  return false;
}
