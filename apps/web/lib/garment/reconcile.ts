import { conditionsHold } from "./conditions";
import type { Dropped } from "./dropped";
import { choiceName, panelName, pointName } from "./labels";
import { nonEmpty } from "./non-empty";
import type { OptionChoice } from "./parts";
import type { ResolvedType } from "./registry";
import { fittingMarks, PLACE_DEFINITIONS, withoutMarks } from "./names-numbers";
import { artworkProblem } from "./spec-checks";
import { keepApplyingSizeValues } from "./size-values";
import { dropStaleTechFields } from "./tech-reconcile";
import type { GarmentSpec } from "./spec-schema";

type Options = Readonly<Record<string, OptionChoice>>;

export interface Reconciled<T> {
  readonly value: T;
  /** What was removed or reset, one entry each. */
  readonly dropped: readonly Dropped[];
}

/** A default that was worked out from the garment type, not chosen by anyone. */
const derivedChoice = (choiceId: string): OptionChoice => ({ choiceId, provenance: "derived" });

/**
 * Moves chosen options onto a type. A choice the type still offers is kept, with its
 * provenance. A choice it does not offer is reset to the default and marked derived.
 * Options the type lacks are removed. Options the old choices lacked get their default.
 */
export function carryOptions(previous: Options, type: ResolvedType): Reconciled<Options> {
  const dropped: Dropped[] = [];
  const next: Record<string, OptionChoice> = {};
  for (const option of type.options) {
    const before = Object.hasOwn(previous, option.id) ? previous[option.id] : undefined;
    if (before && option.choices.some((choice) => choice.id === before.choiceId)) {
      next[option.id] = before;
      continue;
    }
    next[option.id] = derivedChoice(option.defaultChoice);
    if (before) {
      dropped.push({
        kind: "option",
        id: option.id,
        message: `${option.label} was reset to ${choiceName(option, option.defaultChoice)}, because ${type.label} does not offer ${choiceName(option, before.choiceId)}.`,
      });
    }
  }
  const known = new Set(type.options.map((option) => option.id));
  for (const key of Object.keys(previous).filter((key) => !known.has(key))) {
    dropped.push({ kind: "option", id: key, message: `The option ${key} was removed, because ${type.label} does not have it.` });
  }
  return { value: next, dropped };
}

/**
 * When kept choices clash, sets the options named by each broken rule back to this
 * type's defaults. This lets a change of type succeed where the old choices cannot stay.
 */
export function repairClashes(options: Options, type: ResolvedType): Reconciled<Options> {
  const next: Record<string, OptionChoice> = { ...options };
  const dropped: Dropped[] = [];
  for (const rule of type.rules.filter((entry) => conditionsHold(entry.when, options))) {
    for (const condition of rule.when) {
      const option = type.options.find((entry) => entry.id === condition.option);
      if (!option || next[option.id]?.choiceId === option.defaultChoice) continue;
      next[option.id] = derivedChoice(option.defaultChoice);
      dropped.push({
        kind: "option",
        id: option.id,
        message: `${option.label} was reset to ${choiceName(option, option.defaultChoice)}. ${rule.reason}`,
      });
    }
  }
  return { value: next, dropped };
}

/**
 * Removes anything that no longer fits after the options or type changed: measurements
 * for points that no longer apply, colours and fabric assignments for panels that are
 * gone, and artwork whose panel or place is gone.
 */
export function reconcile(spec: GarmentSpec, type: ResolvedType): Reconciled<GarmentSpec> {
  const dropped: Dropped[] = [];
  const measurements = spec.measurements.filter((measurement) => {
    const point = type.pointsOfMeasure.find((entry) => entry.id === measurement.pointId);
    if (point && conditionsHold(point.appliesWhen, spec.options)) return true;
    const reason = point?.unavailableReason ?? `${type.label} does not have it.`;
    dropped.push({
      kind: "measurement",
      id: measurement.pointId,
      message: `The ${pointName(type, measurement.pointId)} measurement was removed. ${reason}`,
    });
    return false;
  });
  const panels = new Set(
    type.panels.filter((panel) => conditionsHold(panel.appliesWhen, spec.options)).map((panel) => panel.id),
  );
  const gone = (panelId: string): string =>
    `${panelName(type, panelId)} was removed, because this garment no longer has that panel.`;
  const colourways = spec.colourways.map((colourway) => ({
    ...colourway,
    colours: colourway.colours.filter((entry) => {
      if (panels.has(entry.panelId)) return true;
      dropped.push({
        kind: "colour",
        id: entry.panelId,
        parentId: colourway.id,
        message: `The colour for ${gone(entry.panelId)}`,
      });
      return false;
    }),
  }));
  const panelFabrics = spec.panelFabrics.filter((entry) => {
    if (panels.has(entry.panelId)) return true;
    dropped.push({ kind: "fabric-assignment", id: entry.panelId, message: `The fabric for ${gone(entry.panelId)}` });
    return false;
  });
  const artwork = spec.artwork.filter((art) => {
    const found = artworkProblem(art, type, spec);
    if (found === null) return true;
    dropped.push({ kind: "artwork", id: art.id, message: `${found} It was removed.` });
    return false;
  });
  const rest = withoutMarks(spec);
  const marks = keptMarks(spec, type, dropped);
  const kept = keepApplyingSizeValues(
    { ...rest, measurements, colourways: nonEmpty(colourways) ?? spec.colourways, panelFabrics, artwork, ...marks },
    type,
    dropped,
  );
  const tech = dropStaleTechFields(kept, type);
  return { value: tech.value, dropped: [...dropped, ...tech.dropped] };
}

/** Names and numbers with only the places the garment still has. Each place dropped is reported. */
function keptMarks(spec: GarmentSpec, type: ResolvedType, dropped: Dropped[]): Pick<GarmentSpec, "namesAndNumbers"> {
  const marks = spec.namesAndNumbers;
  if (marks === undefined) return {};
  const fitting = fittingMarks(marks, type, spec.options);
  for (const entry of marks.places) {
    if (fitting?.places.includes(entry)) continue;
    const label = PLACE_DEFINITIONS[entry.place].label;
    dropped.push({ kind: "names-numbers", id: entry.place, message: `${label} was removed, because ${type.label} has no place for it.` });
  }
  return fitting === null ? {} : { namesAndNumbers: fitting };
}

/**
 * Puts a design onto a type: carries the options across, resets any that clash, then
 * removes what no longer fits. Used when the type changes and when old data is repaired.
 */
export function retype(spec: GarmentSpec, type: ResolvedType): Reconciled<GarmentSpec> {
  const carried = carryOptions(spec.options, type);
  const repaired = repairClashes(carried.value, type);
  const tidy = reconcile({ ...spec, typeId: type.id, options: repaired.value }, type);
  return { value: tidy.value, dropped: [...carried.dropped, ...repaired.dropped, ...tidy.dropped] };
}
