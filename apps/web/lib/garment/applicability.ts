import type { PanelDefinition, PointOfMeasure } from "./definitions";
import { conditionsHold, type ChoiceMap } from "./conditions";
import { getType } from "./registry";

/** The part of a spec that decides what applies: the type and the chosen options. */
export interface SpecShape {
  readonly typeId: string;
  readonly options: ChoiceMap;
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
