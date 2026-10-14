import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ImageItem, PieceScene } from "../scene";
import { apply, applyAll, invert, type Pt } from "../geometry/affine";
import { boundsOf, pointInRing } from "../geometry/polygon";
import { growRing } from "../geometry/clip";
import { flattenScene } from "../render/raster";
import { toPageMatrix } from "../render/format";
import { FIDUCIALS, realWorld, specOf, testCard, type RealWorld } from "../fixtures/real";
import { polkaStack } from "../fixtures/stacks";

/**
 * Plan W3, acceptance case 2, for real: a 6000 x 8000 px test card goes through W7b's intake (the full size print copy is
 * kept), is read back by W7b's brand-scoped reader, and is laid on the front and back of the pattern library's pieces.
 */
const CARD_W = 6000;
const CARD_H = 8000;
const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;

const panel = (assetId: string, view: "front" | "back", extra: Record<string, unknown> = {}) => ({
  ...common, id: `art-${view}`, kind: "image-fill", views: [view], assetId, mode: "panel", fit: "cover", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: false, ...extra,
});

let world: RealWorld;
let assetId: string;
const stackOf = (extra: Record<string, unknown> = {}) => polkaStack([panel(assetId, "front", extra), panel(assetId, "back", extra)], {});

async function setup() {
  world = await realWorld();
  assetId = await world.upload(await testCard(CARD_W, CARD_H), "Test card.png");
}

/** Where each fiducial should be on the piece, worked out from the design plane alone (cover: the card fills the bleed outline). */
function expectedFiducials(builder: RealWorld["builder"] extends (...a: never[]) => infer B ? B : never, scene: PieceScene, size: string, view: string): Pt[] {
  const frame = builder.mapper.placed(size).find((p) => p.instance.id === view)!.frame;
  const box = boundsOf(applyAll(frame.toDesign, scene.bleed));
  const s = Math.max((box.maxX - box.minX) / CARD_W, (box.maxY - box.minY) / CARD_H);
  const centre: Pt = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  return FIDUCIALS.map(([fx, fy]) => apply(frame.toPiece, [centre[0] + (fx - 0.5) * CARD_W * s, centre[1] + (fy - 0.5) * CARD_H * s]));
}

const fiducialsFromMatrix = (item: ImageItem): Pt[] => FIDUCIALS.map(([fx, fy]) => apply(item.matrix, [fx * item.widthPx, fy * item.heightPx]));

describe("case 2: a user's full panel picture, read through the real intake and reader", () => {
  it("lands every fiducial within 1 mm of its place on the piece, in every size, front and back", async () => {
    await setup();
    const builder = world.builder(stackOf());
    for (const size of world.pattern.sizes) {
      for (const view of ["front", "back"] as const) {
        const { scene } = (await builder.buildFile(specOf(view, size, "svg"))).scene;
        const image = scene.items.find((i): i is ImageItem => i.kind === "image");
        if (!image) throw new Error(`No picture on ${view} ${size}`);
        const want = expectedFiducials(builder, scene, size, view);
        fiducialsFromMatrix(image).forEach((got, at) => {
          expect(Math.hypot(got[0] - want[at]![0], got[1] - want[at]![1]), `${size} ${view} fiducial ${at}`).toBeLessThan(1);
        });
      }
    }
  }, 240_000);

  it("shows the fiducials in the pixels of the file, not only in the maths, and the picture goes on through the bleed", async () => {
    await setup();
    const builder = world.builder(stackOf());
    for (const size of ["XS", "3XL"]) {
      const { scene } = (await builder.buildFile(specOf("front", size, "svg"))).scene;
      const flat = await flattenScene(scene);
      const { data, info } = await sharp(flat.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const toPx = (p: Pt): Pt => {
        const page = apply(toPageMatrix(scene), p);
        return [(page[0] / 25.4) * flat.dpi, (page[1] / 25.4) * flat.dpi];
      };
      const want = expectedFiducials(builder, scene, size, "front");
      want.forEach(([x, y], at) => {
        const [px, py] = toPx([x, y]);
        let sx = 0, sy = 0, n = 0;
        for (let yy = Math.max(0, Math.round(py) - 60); yy < Math.min(info.height, Math.round(py) + 60); yy += 1) {
          for (let xx = Math.max(0, Math.round(px) - 60); xx < Math.min(info.width, Math.round(px) + 60); xx += 1) {
            const o = (yy * info.width + xx) * 4;
            if (data[o + 3]! > 200 && data[o]! < 60 && data[o + 1]! < 60) { sx += xx; sy += yy; n += 1; }
          }
        }
        expect(n, `${size} fiducial ${at} has black pixels`).toBeGreaterThan(50);
        const mm = (v: number): number => (v / flat.dpi) * 25.4;
        expect(Math.hypot(mm(sx / n - px), mm(sy / n - py)), `${size} fiducial ${at}`).toBeLessThan(1);
      });
      // Bleed continues the art: the picture's own rectangle covers the whole bleed outline, so nothing is stretched from an edge.
      const image = scene.items.find((i): i is ImageItem => i.kind === "image")!;
      const picture = boundsOf(applyAll(image.matrix, [[0, 0], [image.widthPx, image.heightPx]]));
      const bleed = boundsOf(scene.bleed);
      expect(picture.minX).toBeLessThanOrEqual(bleed.minX + 0.5);
      expect(picture.maxX).toBeGreaterThanOrEqual(bleed.maxX - 0.5);
      expect(picture.minY).toBeLessThanOrEqual(bleed.minY + 0.5);
      expect(picture.maxY).toBeGreaterThanOrEqual(bleed.maxY - 0.5);
      // And in the pixels: between 2 and 13 mm outside the cut line the file shows the card's own checker, cell for cell.
      const source = await sharp(await world.assets.getAsset(assetId).then((a) => a!.readPrintCopy())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const inner = growRing(scene.cut, 2, "miter");
      const outer = growRing(scene.cut, 13, "miter");
      const back = invert(image.matrix);
      const box = boundsOf(outer);
      let compared = 0;
      for (let x = box.minX; x < box.maxX && compared < 400; x += 11.3) {
        for (let y = box.minY; y < box.maxY && compared < 400; y += 11.7) {
          const p: Pt = [x, y];
          if (!pointInRing(p, outer) || pointInRing(p, inner)) continue;
          const [cx, cy] = apply(back, p);
          const ratio = image.widthPx / source.info.width;
          const sxp = Math.round(cx / ratio);
          const syp = Math.round(cy / ratio);
          if (sxp < 0 || syp < 0 || sxp >= source.info.width || syp >= source.info.height) continue;
          // Stay clear of cell edges, where resampling blends two greys.
          if (Math.min(sxp % 100, 100 - (sxp % 100), syp % 100, 100 - (syp % 100)) < 8) continue;
          const want = source.data[(syp * source.info.width + sxp) * 4]!;
          const [qx, qy] = toPx(p);
          const got = data[(Math.round(qy) * info.width + Math.round(qx)) * 4]!;
          expect(Math.abs(got - want), `${size} bleed at ${x.toFixed(0)},${y.toFixed(0)}`).toBeLessThan(6);
          compared += 1;
        }
      }
      expect(compared).toBeGreaterThan(100);
    }
  }, 600_000);

  it("reports the effective dpi of the picture on every piece, and warns below the print house's minimum when it is forced small", async () => {
    await setup();
    const fine = await world.builder(stackOf()).buildFile(specOf("front", "M", "pdf"));
    expect(fine.scene.lowestDpi).toBeGreaterThan(150);
    expect(fine.scene.scene.noteLines.some((l) => /Lowest picture on this piece: \d+ dpi/.test(l))).toBe(true);
    expect(fine.warnings.some((w) => /dpi/.test(w))).toBe(false);
    const forced = await world.builder(stackOf({ scale: 2.5 })).buildFile(specOf("front", "M", "pdf"));
    const warning = forced.warnings.find((w) => /would print at about \d+ dpi/.test(w));
    expect(warning).toBeDefined();
    expect(forced.scene.scene.noteLines.some((l) => /Check: .*would print at about/.test(l))).toBe(true);
  }, 240_000);

  it("never reads the screen copy, and reads only the full size print copy", async () => {
    await setup();
    const reads: string[] = [];
    const asset = await world.assets.getAsset(assetId);
    const spying = { getAsset: async (id: string) => (id === assetId && asset ? { ...asset, readPrintCopy: async () => (reads.push("print"), asset.readPrintCopy()), readScreenCopy: async () => (reads.push("screen"), asset.readScreenCopy()) } : null) };
    await world.builder(stackOf(), { assets: spying }).buildFile(specOf("front", "M", "svg"));
    expect(reads).toEqual(["print"]);
  }, 240_000);

  it("embeds the brand's colour profile in the TIFF when one is set, and none when it is not", async () => {
    await setup();
    const p3 = (await sharp({ create: { width: 2, height: 2, channels: 3, background: "#808080" } }).png().withIccProfile("p3").toBuffer().then((b) => sharp(b).metadata())).icc;
    if (!p3) throw new Error("no profile");
    const small = polkaStack([panel(assetId, "front")]);
    const withIcc = await world.builder(small, { icc: new Uint8Array(p3) }).buildFile(specOf("collar", "M", "tiff"));
    const embedded = (await sharp(withIcc.bytes).metadata()).icc;
    expect(Buffer.from(embedded ?? []).equals(Buffer.from(p3))).toBe(true);
    const without = await world.builder(small).buildFile(specOf("collar", "M", "tiff"));
    expect(Buffer.from((await sharp(without.bytes).metadata()).icc ?? []).equals(Buffer.from(p3))).toBe(false);
  }, 240_000);
});
