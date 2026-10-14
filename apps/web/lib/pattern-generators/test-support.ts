import type { GeneratorContext, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { BoundsMm } from "@/lib/artwork-stack/units";

/** For tests: a context over a piece-sized area with three greens and a white ground. */
export const GREENS = ["#2f5d34", "#6b8f3a", "#c8b27a", "#3b3a2a", "#8a6f3f"];
export const GROUND = "#ffffff";
export const PIECE: BoundsMm = { minX: 0, minY: 0, maxX: 600, maxY: 800 };

export const contextFor = (generator: PatternGenerator, over: Partial<GeneratorContext> = {}): GeneratorContext => ({
  view: "front",
  bounds: PIECE,
  landmarks: {},
  datum: { x: 0, y: 200 },
  colours: GREENS.slice(0, generator.maxColours),
  ground: GROUND,
  params: {},
  seed: 7,
  ...over,
});
