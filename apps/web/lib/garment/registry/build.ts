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
import { conditionsHold } from "../conditions";
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

function twice(owner: string, kind: string, ids: readonly string[]): string[] {
  return repeatedIds(kind, ids.map((id) => ({ id }))).map(
    (line) => `${owner} lists the ${kind.toLowerCase()} "${line.split('"')[1]}" twice.`,
  );
}

function optionEntryProblems(type: GarmentType, family: FamilyData): string[] {
  const options = byId(family.options);
  const owner = `Type "${type.id}"`;
  return type.options.flatMap((entry) => {
    const option = options.get(entry.option);
    if (!option) return [`${owner} uses the unknown option "${entry.option}".`];
    const known = new Set(option.choices.map((choice) => choice.id));
    const problems = (entry.choices ?? [])
      .filter((choice) => !known.has(choice))
      .map((choice) => `${owner} offers "${choice}" for "${option.id}", which is not a choice.`);
    if (entry.default !== undefined && !known.has(entry.default)) {
      problems.push(`${owner} sets the default "${entry.default}" for "${option.id}", which is not a choice.`);
    } else if (entry.choices && entry.default === undefined && !entry.choices.includes(option.defaultChoice)) {
      const list = entry.choices.map((choice) => `"${choice}"`).join(", ");
      problems.push(
        `${owner} offers only ${list} for "${option.id}", but its default "${option.defaultChoice}" is not among them. Set a default.`,
      );
    }
    return problems;
  });
}

function startingChoices(type: GarmentType, family: FamilyData): Record<string, string> {
  const options = byId(family.options);
  return Object.fromEntries(
    type.options.flatMap((entry) => {
      const option = options.get(entry.option);
      return option ? [[option.id, entry.default ?? option.defaultChoice]] : [];
    }),
  );
}

function typeProblems(type: GarmentType, family: FamilyData): string[] {
  const points = byId(family.pointsOfMeasure);
  const panels = byId(family.panels);
  const owner = `Type "${type.id}"`;
  const problems = [
    ...twice(owner, "Option", type.options.map((entry) => entry.option)),
    ...twice(owner, "Point of measure", type.pointsOfMeasure),
    ...twice(owner, "Panel", type.panels),
    ...optionEntryProblems(type, family),
    ...type.pointsOfMeasure
      .filter((id) => !points.has(id))
      .map((id) => `${owner} uses the unknown point of measure "${id}".`),
    ...type.panels.filter((id) => !panels.has(id)).map((id) => `${owner} uses the unknown panel "${id}".`),
  ];
  if (problems.length > 0) return problems;
  const start = startingChoices(type, family);
  return family.rules
    .filter((rule) => conditionsHold(rule.when, start))
    .map((rule) => `${owner} starts with a combination that breaks the rule "${rule.id}". ${rule.reason}`);
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

function pick<T>(map: ReadonlyMap<string, T>, ids: readonly string[]): readonly T[] {
  // Every id was checked by checkFamilyData, so nothing is skipped in practice.
  return ids.flatMap((id) => {
    const found = map.get(id);
    return found ? [found] : [];
  });
}

function resolveOptions(type: GarmentType, family: FamilyData): readonly ResolvedOption[] {
  const options = byId(family.options);
  return type.options.flatMap((entry) => {
    const option = options.get(entry.option);
    if (!option) return [];
    const choices = entry.choices
      ? option.choices.filter((choice) => entry.choices?.includes(choice.id))
      : option.choices;
    const defaultChoice = entry.default ?? option.defaultChoice;
    const notOffered = option.choices.filter((choice) => !choices.includes(choice));
    return [Object.freeze({ ...option, choices, defaultChoice, notOffered })];
  });
}

function resolveType(type: GarmentType, family: FamilyData): ResolvedType {
  return Object.freeze({
    id: type.id,
    family: type.family,
    label: type.label,
    wearers: type.wearers,
    options: resolveOptions(type, family),
    pointsOfMeasure: pick(byId(family.pointsOfMeasure), type.pointsOfMeasure),
    panels: pick(byId(family.panels), type.panels),
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
    listTypes: (family) => resolved.filter((type) => !family || type.family === family),
    listFamilies: () => summaries,
  };
}
