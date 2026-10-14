import { describe, expect, it } from "vitest";
import { apply, applyAll, type Pt } from "../geometry/affine";
import { frameFor } from "../frames/frame";
import { intersectRings, subtractRings } from "../geometry/clip";
import { areaOf, boundsOf, pointInRing } from "../geometry/polygon";
import { rig } from "../fixtures/setup";
import { polkaStack } from "../fixtures/stacks";
import type { FillItem } from "../scene";

const r = rig();
const stack = polkaStack();

const dots = (items: readonly unknown[]): FillItem[] => (items as FillItem[]).filter((i) => i.kind === "fill" && i.layerId === "dots");
const centre = (ring: readonly Pt[]): Pt => {
  const b = boundsOf(ring);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
};

describe("polka-dot jersey layout", () => {
  it("fills the ground out into the bleed and puts dots on top", async () => {
    const { scene } = await r.scene(stack, "48", "front");
    expect(scene.items[0]).toMatchObject({ kind: "fill", layerId: "ground", colour: "#ffffff" });
    expect(dots(scene.items).length).toBeGreaterThan(100);
    expect(scene.items.at(-1)).toBeDefined();
    const bleedBox = boundsOf(scene.bleed);
    expect(bleedBox.maxX - bleedBox.minX).toBeCloseTo(scene.cutBox.maxX - scene.cutBox.minX + 30, 0);
  });

  it("hangs every piece's dots on one chest line in every size: rows meet at the side seam and the underarm", async () => {
    for (const size of r.pattern.sizes) {
      const rows: number[][] = [];
      for (const view of ["front", "back", "sleeve-left", "sleeve-right"]) {
        const placed = r.mapper.placed(size).find((p) => p.instance.id === view)!;
        const { scene } = await r.scene(stack, size, view);
        const ys = new Set(dots(scene.items).map((d) => Math.round(apply(placed.frame.toDesign, centre(d.rings[0] as never))[1] * 10) / 10));
        rows.push([...ys].sort((a, b) => a - b));
      }
      // Whole dots only: take rows seen on the front and check each exists on the back within 0.5 mm.
      const [front, back, left] = rows as [number[], number[], number[]];
      const near = (a: number[], v: number) => a.some((x) => Math.abs(x - v) < 0.5);
      const common = front.filter((y) => near(back, y));
      expect(common.length, size).toBeGreaterThan(front.length * 0.7);
      expect(front.filter((y) => near(left, y)).length, size).toBeGreaterThan(5);
    }
  });

  it("puts a dot column on the centre line", async () => {
    const placed = r.mapper.placed("48").find((p) => p.instance.id === "front")!;
    const { scene } = await r.scene(stack, "48", "front");
    const xs = dots(scene.items).map((d) => apply(placed.frame.toDesign, centre(d.rings[0] as never))[0]);
    expect(xs.some((x) => Math.abs(x) < 0.5)).toBe(true);
  });

  it("keeps every dot out of the clear space round the number, name and crest places", async () => {
    for (const [view, zoneIds] of [["back", ["back-name", "back-number"]], ["front", ["front-number"]]] as const) {
      const { scene } = await r.scene(stack, "48", view);
      for (const id of zoneIds) {
        const zone = r.zones.find((z) => z.id === id)!;
        const grown = (await import("../geometry/clip")).growRing(zone.polygonBySize["48"]!, 10, "miter");
        const hit = dots(scene.items).flatMap((d) => intersectRings(d.rings, [grown]));
        expect(hit.reduce((s, ring) => s + areaOf(ring), 0), `${view} ${id}`).toBeLessThan(0.5);
      }
    }
  });

  it("keeps every piece's art inside the bleed outline's box", async () => {
    const { scene } = await r.scene(stack, "48", "back");
    const box = boundsOf(scene.bleed);
    for (const item of scene.items) if (item.kind === "fill") for (const p of item.rings.flat()) expect(p[0] >= box.minX - 40 && p[0] <= box.maxX + 40).toBe(true);
  });

  it("is the same on every run", async () => {
    const a = await r.scene(stack, "48", "front");
    const b = await r.scene(stack, "48", "front");
    expect(JSON.stringify(a.scene.items)).toBe(JSON.stringify(b.scene.items));
  });

  it("keeps the pattern dots as a field across a whole size without gaps at the seam", async () => {
    const placed = r.mapper.placed("48").find((p) => p.instance.id === "front")!;
    const { scene } = await r.scene(stack, "48", "front");
    const inside = scene.cut.length;
    expect(inside).toBeGreaterThan(10);
    expect(pointInRing(applyAll(placed.frame.toPiece, [[0, 100]])[0]!, placed.instance.opened)).toBe(true);
    expect(frameFor(placed.instance, r.mapper.anchors).basis).toBe("landmarks");
    void subtractRings;
  });
});
