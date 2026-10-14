import type { GeneratorContext } from "@/lib/artwork-stack/generator";

/** A jersey-sized front, in design millimetres, with the underarm at 150 mm. */
export const FRONT_BOUNDS = { minX: -250, minY: 0, maxX: 250, maxY: 700 } as const;

export function contextOf(patch: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    view: "front",
    bounds: FRONT_BOUNDS,
    landmarks: { underarm: { x: 250, y: 150 } },
    datum: { x: 0, y: 150 },
    colours: ["#d4af37", "#ffffff", "#2e7d32", "#1b5e20", "#a5d6a7"],
    ground: "#1b2a49",
    params: {},
    seed: 7,
    ...patch,
  };
}
