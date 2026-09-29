import { conditionsHold } from "./applicability";
import { artworkProblem } from "./spec-checks";
import type { GarmentSpec } from "./spec-schema";
import type { ResolvedOption, ResolvedType } from "./registry";

type Options = Readonly<Record<string, string>>;

export interface Reconciled<T> {
  readonly value: T;
  /** Plain sentences saying what was removed or reset. */
  readonly dropped: readonly string[];
}

function labelOf(option: ResolvedOption, choiceId: string): string {
  const found = [...option.choices, ...option.notOffered].find((choice) => choice.id === choiceId);
  return found?.label ?? choiceId;
}

/**
 * Moves chosen options onto another type. A choice the new type still offers is kept.
 * A choice it does not offer is reset to its default. Options the new type lacks are
 * removed. Options the old type lacked get their default.
 */
export function carryOptions(previous: Options, type: ResolvedType): Reconciled<Options> {
  const dropped: string[] = [];
  const next: Record<string, string> = {};
  for (const option of type.options) {
    const before = Object.hasOwn(previous, option.id) ? previous[option.id] : undefined;
    if (before !== undefined && option.choices.some((choice) => choice.id === before)) {
      next[option.id] = before;
      continue;
    }
    next[option.id] = option.defaultChoice;
    if (before !== undefined) {
      dropped.push(
        `${option.label} was reset to ${labelOf(option, option.defaultChoice)}, because ${type.label} does not offer ${labelOf(option, before)}.`,
      );
    }
  }
  const known = new Set(type.options.map((option) => option.id));
  for (const key of Object.keys(previous).filter((key) => !known.has(key))) {
    dropped.push(`The option ${key} was removed, because ${type.label} does not have it.`);
  }
  return { value: next, dropped };
}

/**
 * When kept choices clash, sets the options named by each broken rule back to this
 * type's defaults. This lets a change of type succeed where the old choices cannot stay.
 */
export function repairClashes(options: Options, type: ResolvedType): Reconciled<Options> {
  const next: Record<string, string> = { ...options };
  const dropped: string[] = [];
  const broken = type.rules.filter((rule) => conditionsHold(rule.when, options));
  for (const rule of broken) {
    for (const condition of rule.when) {
      const option = type.options.find((entry) => entry.id === condition.option);
      if (!option || next[option.id] === option.defaultChoice) continue;
      next[option.id] = option.defaultChoice;
      dropped.push(`${option.label} was reset to ${labelOf(option, option.defaultChoice)}. ${rule.reason}`);
    }
  }
  return { value: next, dropped };
}

/**
 * Removes anything that no longer fits after the options or type changed: measurements
 * for points that no longer apply, colours for panels that are gone, and artwork whose
 * panel or place is gone. Returns the tidied spec and a sentence for each removal.
 */
export function reconcile(spec: GarmentSpec, type: ResolvedType): Reconciled<GarmentSpec> {
  const dropped: string[] = [];
  const measurements = spec.measurements.filter((measurement) => {
    const point = type.pointsOfMeasure.find((entry) => entry.id === measurement.pointId);
    if (point && conditionsHold(point.appliesWhen, spec.options)) return true;
    const label = point?.label ?? measurement.pointId;
    dropped.push(`The ${label} measurement was removed. ${point?.unavailableReason ?? `${type.label} does not have it.`}`);
    return false;
  });
  const panels = new Set(
    type.panels.filter((panel) => conditionsHold(panel.appliesWhen, spec.options)).map((panel) => panel.id),
  );
  const colourways = spec.colourways.map((colourway) => ({
    ...colourway,
    colours: colourway.colours.filter((entry) => {
      if (panels.has(entry.panelId)) return true;
      dropped.push(`The colour for ${entry.panelId} was removed from ${colourway.name}, because this garment no longer has that panel.`);
      return false;
    }),
  }));
  const panelFabrics = spec.panelFabrics.filter((entry) => {
    if (panels.has(entry.panelId)) return true;
    dropped.push(`The fabric for ${entry.panelId} was removed, because this garment no longer has that panel.`);
    return false;
  });
  const artwork = spec.artwork.filter((art) => {
    const problem = artworkProblem(art, type, spec);
    if (problem === null) return true;
    dropped.push(`${problem} It was removed.`);
    return false;
  });
  return { value: { ...spec, measurements, colourways, panelFabrics, artwork }, dropped };
}
