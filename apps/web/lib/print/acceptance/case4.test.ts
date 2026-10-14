import { describe, expect, it } from "vitest";
import { getGenerator } from "@/lib/pattern-generators";
import type { FillItem, PieceScene } from "../scene";
import { apply, type Pt } from "../geometry/affine";
import { pointInRing } from "../geometry/polygon";
import { realWorld, specOf, type RealWorld } from "../fixtures/real";
import { polkaStack } from "../fixtures/stacks";

/** Plan W3, acceptance case 4, for real: W7c's camo generator, seed 7, drawn by the real registry. */
const camoStack = (seed: number) => {
  const base = polkaStack();
  // No names or numbers: their clear space cuts the pattern away, which is the point of it but not what is measured here.
  return { ...base, layers: base.layers.filter((l) => l.kind !== "player-mark").map((l) => (l.kind === "pattern" ? { ...l, generatorId: "camo", params: {}, seed, colourIds: ["red", "blue", "navy"] } : l)) };
};

/** The colour a scene shows at a point of its piece: the last fill of the pattern layer that covers it, else the ground. */
const colourAt = (scene: PieceScene, point: Pt): string => {
  let colour = "ground";
  for (const item of scene.items) {
    if (item.kind !== "fill" || item.layerId !== "dots") continue;
    if (item.rings.some((ring) => pointInRing(point, ring))) colour = item.colour;
  }
  return colour;
};

describe("case 4: a W7c camo style, seed 7", () => {
  it("is the registry's own camo, not a stand-in", () => {
    expect(getGenerator("camo")?.label).toBeTruthy();
  });

  it("gives byte-identical files twice, in every format, and other bytes for another seed", async () => {
    const world = await realWorld();
    for (const format of ["pdf", "svg"] as const) {
      const [a, b, c] = [
        await world.builder(camoStack(7)).build(specOf("front", "M", format)),
        await world.builder(camoStack(7)).build(specOf("front", "M", format)),
        await world.builder(camoStack(8)).build(specOf("front", "M", format)),
      ];
      expect(a.sha256, format).toBe(b.sha256);
      expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
      expect(a.sha256, format).not.toBe(c.sha256);
    }
  }, 120_000);

  it("draws a camo field that is continuous across the side seam, in every size", async () => {
    // The back lies on the design plane the other way round, so the seam that joins the front and the back is at x = a on the front and x = b on the back, with the
    // underarm landmarks there. A point (x, y) on the front and the point (a + b - x, y) on the back are the same place on the cloth, and show the same colour.
    const world = await realWorld();
    const builder = world.builder(camoStack(7));
    for (const size of world.pattern.sizes) {
      const placed = builder.mapper.placed(size);
      const [front, back] = await Promise.all(
        ["front", "back"].map(async (id) => {
          const mine = placed.find((p) => p.instance.id === id)!;
          const underarm = apply(mine.frame.toDesign, mine.instance.piece.landmarks.underarm as Pt);
          return { built: (await builder.buildFile(specOf(id, size, "svg"))).scene.scene, frame: mine.frame, seamX: underarm[0] };
        }),
      );
      expect(front!.built.items.filter((i): i is FillItem => i.kind === "fill" && i.layerId === "dots").length).toBeGreaterThan(20);
      const join = front!.seamX + back!.seamX;
      let checked = 0;
      for (let x = -400; x <= 400; x += 7) {
        for (let y = -200; y <= 500; y += 7) {
          const onFront = apply(front!.frame.toPiece, [x, y]);
          const onBack = apply(back!.frame.toPiece, [join - x, y]);
          if (!pointInRing(onFront, front!.built.bleed) || !pointInRing(onBack, back!.built.bleed)) continue;
          expect(colourAt(front!.built, onFront), `${size} at ${x},${y}`).toBe(colourAt(back!.built, onBack));
          checked += 1;
        }
      }
      expect(checked, `${size} points checked`).toBeGreaterThan(1000);
    }
  }, 240_000);
});
