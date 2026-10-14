import type { BoundsMm, PointMm } from "@/lib/artwork-stack/units";
import { defineGenerator } from "../define";
import { polygon } from "../geometry";
import type { GeneratorParam } from "../params";
import { createRng, hashSeed } from "../prng";

const RHYTHMS = ["even", "graduated", "double", "irregular"] as const;

const PARAMS: readonly GeneratorParam[] = [
  { id: "rhythm", label: "Stripe rhythm", unit: "none", min: 0, max: 3, step: 1, default: 0, choices: RHYTHMS },
  { id: "width", label: "Stripe width", noun: "stripe", unit: "mm", min: 5, max: 100, step: 5, default: 30, words: { up: ["wider", "bigger", "thicker"], down: ["narrower", "smaller", "thinner"] } },
  { id: "angle", label: "Stripe direction", noun: "direction", unit: "degrees", min: 0, max: 180, step: 15, default: 90 },
  { id: "grow", label: "How much stripes change", noun: "change", unit: "ratio", min: 0, max: 1, step: 0.1, default: 0.5, words: { up: ["more graduated", "more varied"], down: ["less graduated", "more even"] } },
];

interface Segment {
  readonly width: number;
  /** Position in the colour list, or null for the colour under. */
  readonly ink: number | null;
}

/**
 * The stripe at whole-number position `k`, counted from the datum (0 and up one way, -1 and down the other). Each
 * stripe is a pure function of its position, so the pattern is the same whatever area is drawn.
 */
function segmentAt(k: number, rhythm: number, width: number, grow: number, seed: number, inks: number): Segment {
  const pair = Math.abs(k) % 2;
  const ink = pair === 0 ? 0 : inks > 1 ? 1 : null;
  if (rhythm === 1) return { width: width * (1 + grow * 0.35 * Math.abs(k)), ink };
  if (rhythm === 2) return { width: width * [1, 0.5, 0.35, 0.5][Math.abs(k) % 4], ink: Math.abs(k) % 4 === 0 || Math.abs(k) % 4 === 2 ? 0 : null };
  if (rhythm === 3) return { width: width * (1 - grow * 0.6 + grow * 1.2 * createRng(hashSeed(seed, k)).float()), ink };
  return { width, ink };
}

/** Where stripe `k` starts and ends along the normal, counted from the datum. */
function edgesOf(k: number, segmentOf: (at: number) => Segment): [number, number] {
  const sum = (from: number, to: number): number => Array.from({ length: Math.max(0, to - from) }, (_, at) => segmentOf(from + at).width).reduce((a, b) => a + b, 0);
  const start = k >= 0 ? sum(0, k) : -sum(k + 1, 1);
  return [start, start + segmentOf(k).width];
}

const reachOf = (bounds: BoundsMm, from: PointMm): number =>
  Math.max(...[bounds.minX, bounds.maxX].flatMap((x) => [bounds.minY, bounds.maxY].map((y) => Math.hypot(x - from.x, y - from.y)))) + 1;

/** Even, graduated, double and irregular stripes at any angle, laid from the datum. */
export const stripeVariations = defineGenerator({
  id: "stripe-variations",
  label: "Stripe variations",
  summary: "Stripes that grow, pair up or vary, at any angle.",
  aliases: ["stripe variations", "stripes", "stripe", "diagonal", "diagonal stripes", "graduated stripes"],
  params: PARAMS,
  maxColours: 2,
  period: (values) => ({ width: values.width * 2, height: values.width * 2 }),
  draw({ context, values, inks }) {
    const reach = reachOf(context.bounds, context.datum);
    const segmentOf = (k: number): Segment => segmentAt(k, Math.round(values.rhythm), values.width, values.grow, context.seed, inks.length);
    const radians = (values.angle * Math.PI) / 180;
    const [dx, dy] = [Math.cos(radians), Math.sin(radians)];
    const [nx, ny] = [-dy, dx];
    const at = (n: number, s: number): PointMm => ({ x: context.datum.x + nx * n + dx * s, y: context.datum.y + ny * n + dy * s });
    const stripes: ReturnType<typeof polygon>[] = [];
    const walk = (first: number, step: 1 | -1): void => {
      for (let k = first; ; k += step) {
        const [from, to] = edgesOf(k, segmentOf);
        if (step === 1 ? from > reach : to < -reach) return;
        const { ink } = segmentOf(k);
        if (ink !== null) stripes.push(polygon([at(from, -reach), at(to, -reach), at(to, reach), at(from, reach)], inks[ink] ?? inks[0], "Stripe"));
      }
    };
    walk(0, 1);
    walk(-1, -1);
    return { shapes: stripes };
  },
});
