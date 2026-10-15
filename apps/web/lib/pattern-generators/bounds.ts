import type { DisplayList, GeneratorContext, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { BoundsMm } from "@/lib/artwork-stack/units";

/** A plain sentence when the area to draw cannot be drawn (not a number, endless, or no size), otherwise null. */
export function boundsProblem(bounds: BoundsMm): string | null {
  const edges = [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
  if (!edges.every(Number.isFinite)) return "The pattern area has an edge that is not a real measurement, so nothing was drawn.";
  if (bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) return "The pattern area has no size, so nothing was drawn.";
  return null;
}

/** The generator, refusing a broken area with a plain error before it draws anything. Everything else is passed through. */
export function withBoundsCheck<G extends PatternGenerator>(generator: G): G {
  return {
    ...generator,
    render(context: GeneratorContext): DisplayList {
      const problem = boundsProblem(context.bounds);
      if (problem !== null) throw new Error(problem);
      return generator.render(context);
    },
  };
}
