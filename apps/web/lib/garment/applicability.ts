import type { Condition, PanelDefinition, PointOfMeasure } from "./definitions";
import { getType } from "./registry";

/** The part of a spec that decides what applies: the type and the chosen options. */
export interface SpecShape {
  readonly typeId: string;
  readonly options: Readonly<Record<string, string>>;
}

/**
 * True when every condition holds. An option that is not chosen never satisfies a
 * condition, so a garment without a placket option has no placket.
 */
export function conditionsHold(
  conditions: readonly Condition[],
  options: Readonly<Record<string, string>>,
): boolean {
  return conditions.every((condition) => {
    const chosen = Object.hasOwn(options, condition.option) ? options[condition.option] : undefined;
    return chosen !== undefined && condition.in.includes(chosen);
  });
}

/** The points of measure that apply to this spec. An unknown type has none. */
export function pointsOfMeasureFor(spec: SpecShape): readonly PointOfMeasure[] {
  const type = getType(spec.typeId);
  if (!type) return [];
  return type.pointsOfMeasure.filter((point) => conditionsHold(point.appliesWhen, spec.options));
}

/** The panels this spec has, each of which can be given a colour. An unknown type has none. */
export function panelsFor(spec: SpecShape): readonly PanelDefinition[] {
  const type = getType(spec.typeId);
  if (!type) return [];
  return type.panels.filter((panel) => conditionsHold(panel.appliesWhen, spec.options));
}
