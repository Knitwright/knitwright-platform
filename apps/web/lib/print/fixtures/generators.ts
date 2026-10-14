import type { DisplayShape, GeneratorContext, PatternGenerator } from "@/lib/artwork-stack";
import { roundMm } from "@/lib/artwork-stack";

/** One small integer hash, the same on any machine: the seeded generator the real library shares (W7c). */
export function hash(a: number, b: number, seed: number): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A stand-in for a W7c camo generator: blobs on a grid, defined on the whole design plane from absolute coordinates, so
 * it is continuous wherever two bounds meet. Phase B runs case 4 on the real one.
 */
export const testCamo: PatternGenerator = {
  id: "test-camo",
  label: "Test camo",
  params: [{ id: "blobMm", label: "Blob size", unit: "mm", min: 20, max: 120, step: 5, default: 60 }],
  repeat: { kind: "field" },
  maxColours: 3,
  render(context: GeneratorContext) {
    const cell = typeof context.params.blobMm === "number" ? context.params.blobMm : 60;
    const { minX, minY, maxX, maxY } = context.bounds;
    const shapes: DisplayShape[] = [{ kind: "polygon", fill: context.colours[0] ?? context.ground, points: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] }];
    for (let i = Math.floor(minX / cell) - 1; i <= Math.ceil(maxX / cell) + 1; i += 1) {
      for (let j = Math.floor(minY / cell) - 1; j <= Math.ceil(maxY / cell) + 1; j += 1) {
        const h = hash(i, j, context.seed);
        const colour = context.colours[1 + (h % Math.max(1, context.colours.length - 1))] ?? context.ground;
        const [cx, cy, r] = [(i + 0.2 + ((h >>> 8) % 60) / 100) * cell, (j + 0.2 + ((h >>> 16) % 60) / 100) * cell, cell * (0.45 + ((h >>> 24) % 30) / 100)];
        shapes.push({
          kind: "polygon",
          fill: colour,
          points: Array.from({ length: 10 }, (_, k) => ({ x: roundMm(cx + Math.cos((k / 10) * Math.PI * 2) * r), y: roundMm(cy + Math.sin((k / 10) * Math.PI * 2) * r) })),
        });
      }
    }
    return { shapes };
  },
};
