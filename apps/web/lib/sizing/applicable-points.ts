import type { PointOfMeasure, ResolvedType } from "@/lib/garment";

/**
 * The points of measure a garment type can ever have. A point that applies only with an
 * option the type does not offer, such as a placket on a tee, does not belong to it.
 */
export function pointsThatCanApply(type: ResolvedType): readonly PointOfMeasure[] {
  return type.pointsOfMeasure.filter((point) =>
    point.appliesWhen.every((condition) => {
      const option = type.options.find((candidate) => candidate.id === condition.option);
      return option !== undefined && option.choices.some((choice) => condition.in.includes(choice.id));
    }),
  );
}
