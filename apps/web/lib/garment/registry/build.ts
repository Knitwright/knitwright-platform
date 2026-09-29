import {
  familyDataSchema,
  type Condition,
  type FamilyData,
  type GarmentType,
  type OptionDefinition,
  type PanelDefinition,
  type PointOfMeasure,
  type Rule,
} from "../definitions";
import type { FamilyId } from "../primitives";

/** An option as one garment type offers it: choices may be fewer than the family has. */
export interface ResolvedOption extends OptionDefinition {
  /** Choices the family has that this type does not offer. Kept so messages can name them. */
  readonly notOffered: OptionDefinition["choices"];
}

/** A garment type with every reference looked up, ready for the rest of the library. */
export interface ResolvedType {
  readonly id: string;
  readonly family: FamilyId;
  readonly label: string;
  readonly wearers: GarmentType["wearers"];
  readonly options: readonly ResolvedOption[];
  readonly pointsOfMeasure: readonly PointOfMeasure[];
  readonly panels: readonly PanelDefinition[];
  readonly rules: readonly Rule[];
}

export interface Registry {
  getType(id: string): ResolvedType | undefined;
  listTypes(family?: FamilyId): readonly ResolvedType[];
  listFamilies(): readonly { readonly id: FamilyId; readonly label: string }[];
}

const byId = <T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> =>
  new Map(items.map((item) => [item.id, item]));

function repeatedIds(kind: string, items: readonly { readonly id: string }[]): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const item of items) {
    if (seen.has(item.id)) problems.push(`${kind} id "${item.id}" is used twice.`);
    seen.add(item.id);
  }
  return problems;
}

function conditionProblems(
  owner: string,
  conditions: readonly Condition[],
  options: ReadonlyMap<string, OptionDefinition>,
): string[] {
  return conditions.flatMap((condition) => {
    const option = options.get(condition.option);
    if (!option) return [`${owner} checks the unknown option "${condition.option}".`];
    const known = new Set(option.choices.map((choice) => choice.id));
    return condition.in
      .filter((choice) => !known.has(choice))
      .map((choice) => `${owner} checks "${choice}", which is not a choice of "${option.id}".`);
  });
}

function typeProblems(type: GarmentType, family: FamilyData): string[] {
  const options = byId(family.options);
  const points = byId(family.pointsOfMeasure);
  const panels = byId(family.panels);
  const owner = `Type "${type.id}"`;
  const problems: string[] = [];
  for (const entry of type.options) {
    const option = options.get(entry.option);
    if (!option) {
      problems.push(`${owner} uses the unknown option "${entry.option}".`);
      continue;
    }
    const known = new Set(option.choices.map((choice) => choice.id));
    for (const choice of entry.choices ?? []) {
      if (!known.has(choice)) {
        problems.push(`${owner} offers "${choice}" for "${option.id}", which is not a choice.`);
      }
    }
  }
  for (const id of type.pointsOfMeasure) {
    if (!points.has(id)) problems.push(`${owner} uses the unknown point of measure "${id}".`);
  }
  for (const id of type.panels) {
    if (!panels.has(id)) problems.push(`${owner} uses the unknown panel "${id}".`);
  }
  return problems;
}

/** Lists every mistake in one family's data. An empty list means the data is sound. */
export function checkFamilyData(family: FamilyData): string[] {
  const options = byId(family.options);
  return [
    ...repeatedIds("Option", family.options),
    ...repeatedIds("Point of measure", family.pointsOfMeasure),
    ...repeatedIds("Panel", family.panels),
    ...repeatedIds("Rule", family.rules),
    ...repeatedIds("Type", family.types),
    ...family.types.flatMap((type) => typeProblems(type, family)),
    ...family.pointsOfMeasure.flatMap((point) =>
      conditionProblems(`Point of measure "${point.id}"`, point.appliesWhen, options),
    ),
    ...family.panels.flatMap((panel) =>
      conditionProblems(`Panel "${panel.id}"`, panel.appliesWhen, options),
    ),
    ...family.rules.flatMap((rule) => conditionProblems(`Rule "${rule.id}"`, rule.when, options)),
  ];
}

function resolveOptions(type: GarmentType, family: FamilyData): readonly ResolvedOption[] {
  const options = byId(family.options);
  return type.options.map((entry) => {
    const option = options.get(entry.option) as OptionDefinition; // checked by checkFamilyData
    const choices = entry.choices
      ? option.choices.filter((choice) => entry.choices?.includes(choice.id))
      : option.choices;
    const wanted = entry.default ?? option.defaultChoice;
    const defaultChoice = choices.some((choice) => choice.id === wanted)
      ? wanted
      : (choices[0]?.id as string); // choices is never empty
    const notOffered = option.choices.filter((choice) => !choices.includes(choice));
    return Object.freeze({ ...option, choices, defaultChoice, notOffered });
  });
}

function resolveType(type: GarmentType, family: FamilyData): ResolvedType {
  const points = byId(family.pointsOfMeasure);
  const panels = byId(family.panels);
  // Every id was checked by checkFamilyData, so the lookups below always succeed.
  return Object.freeze({
    id: type.id,
    family: type.family,
    label: type.label,
    wearers: type.wearers,
    options: resolveOptions(type, family),
    pointsOfMeasure: type.pointsOfMeasure.map((id) => points.get(id) as PointOfMeasure),
    panels: type.panels.map((id) => panels.get(id) as PanelDefinition),
    rules: family.rules,
  });
}

/** Builds the registry from family data. It throws if the data has a mistake. */
export function buildRegistry(families: readonly FamilyData[]): Registry {
  const parsed = families.map((family) => familyDataSchema.parse(family));
  const problems = [
    ...parsed.flatMap(checkFamilyData),
    ...repeatedIds("Type", parsed.flatMap((family) => family.types)),
  ];
  if (problems.length > 0) {
    throw new Error(["The garment registry data is not sound.", ...problems].join("\n"));
  }
  const resolved = parsed.flatMap((family) => family.types.map((type) => resolveType(type, family)));
  const types = byId(resolved);
  const summaries = parsed.map(({ id, label }) => ({ id, label }));
  return {
    getType: (id) => types.get(id),
    listTypes: (family) => (family ? resolved.filter((type) => type.family === family) : resolved),
    listFamilies: () => summaries,
  };
}
