import type { ComponentSlot, FamilyData, OptionDefinition, PanelDefinition, PointOfMeasure, Rule, SeamDefinition } from "../../definitions";
import type { FamilyId } from "../../primitives";

/** The parts of a family that a kind of article brings with it. A family is the kits its articles need. */
export interface Kit {
  readonly options: readonly OptionDefinition[];
  readonly pointsOfMeasure: readonly PointOfMeasure[];
  readonly panels: readonly PanelDefinition[];
  readonly rules: readonly Rule[];
  readonly seams: readonly SeamDefinition[];
  readonly components: readonly ComponentSlot[];
}

export const EMPTY_KIT: Kit = { options: [], pointsOfMeasure: [], panels: [], rules: [], seams: [], components: [] };

/** Keeps the first item of each id. The kits are listed with the one whose wording wins first. */
const firstOfEach = <T extends { readonly id: string }>(items: readonly T[]): readonly T[] => {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
};

/** One family from the kits its articles need. Nothing is copied: the kits hold the data. */
export function composeFamily(
  id: FamilyId,
  label: string,
  kits: readonly Kit[],
  types: FamilyData["types"],
): FamilyData {
  return {
    id,
    label,
    options: firstOfEach(kits.flatMap((kit) => kit.options)),
    pointsOfMeasure: firstOfEach(kits.flatMap((kit) => kit.pointsOfMeasure)),
    panels: firstOfEach(kits.flatMap((kit) => kit.panels)),
    rules: firstOfEach(kits.flatMap((kit) => kit.rules)),
    seams: firstOfEach(kits.flatMap((kit) => kit.seams)),
    components: firstOfEach(kits.flatMap((kit) => kit.components)),
    types,
  };
}
