import { conditionsHold } from "./applicability";
import { checkCombination } from "./combinations";
import type { Artwork, Colourway, FabricSpec, Measurement, PanelFabric } from "./parts";
import type { Wearer } from "./primitives";
import { getType, type ResolvedType } from "./registry";

/** One thing wrong with a spec, in plain words, and where in the spec it is. */
export interface SpecProblem {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** The fields the meaning checks read. They are all a spec has beyond its shape. */
export interface CheckedSpec {
  readonly typeId: string;
  readonly wearer: Wearer;
  readonly options: Readonly<Record<string, string>>;
  readonly measurements: readonly Measurement[];
  readonly fabrics: readonly FabricSpec[];
  readonly panelFabrics: readonly PanelFabric[];
  readonly colourways: readonly Colourway[];
  readonly artwork: readonly Artwork[];
}

const problem = (path: readonly (string | number)[], message: string): SpecProblem => ({ path, message });

/** Every value that appears more than once, in the order the repeat is found. */
function repeats(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const again: string[] = [];
  for (const value of values) {
    if (seen.has(value)) again.push(value);
    seen.add(value);
  }
  return again;
}

function optionProblems(spec: CheckedSpec, type: ResolvedType): SpecProblem[] {
  const found: SpecProblem[] = [];
  for (const option of type.options) {
    const chosen = Object.hasOwn(spec.options, option.id) ? spec.options[option.id] : undefined;
    if (chosen === undefined) {
      found.push(problem(["options", option.id], `Choose a value for ${option.label}.`));
    } else if (!option.choices.some((choice) => choice.id === chosen)) {
      const name = option.notOffered.find((choice) => choice.id === chosen)?.label ?? chosen;
      found.push(problem(["options", option.id], `${name} is not offered for ${option.label} on ${type.label}.`));
    }
  }
  const known = new Set(type.options.map((option) => option.id));
  for (const key of Object.keys(spec.options).filter((key) => !known.has(key))) {
    found.push(problem(["options", key], `The option ${key} does not apply to ${type.label}.`));
  }
  return found;
}

function measurementProblems(spec: CheckedSpec, type: ResolvedType): SpecProblem[] {
  const found: SpecProblem[] = [];
  spec.measurements.forEach((measurement, index) => {
    const point = type.pointsOfMeasure.find((entry) => entry.id === measurement.pointId);
    const path = ["measurements", index, "pointId"];
    if (!point) {
      found.push(problem(path, `${measurement.pointId} is not a point of measure for ${type.label}.`));
    } else if (!conditionsHold(point.appliesWhen, spec.options)) {
      found.push(problem(path, point.unavailableReason ?? `${point.label} does not apply to this garment.`));
    }
  });
  for (const id of repeats(spec.measurements.map((measurement) => measurement.pointId))) {
    found.push(problem(["measurements"], `${id} is listed more than once.`));
  }
  return found;
}

function fabricProblems(spec: CheckedSpec, panels: ReadonlySet<string>): SpecProblem[] {
  const ids = new Set(spec.fabrics.map((fabric) => fabric.id));
  const found = repeats(spec.fabrics.map((fabric) => fabric.id)).map((id) =>
    problem(["fabrics"], `The fabric id ${id} is used more than once.`),
  );
  spec.panelFabrics.forEach((entry, index) => {
    const path = ["panelFabrics", index];
    if (!panels.has(entry.panelId)) {
      found.push(problem(path, `The fabric assignment for ${entry.panelId} names a panel this garment does not have.`));
    } else if (!ids.has(entry.fabricId)) {
      found.push(problem(path, `The fabric assignment for ${entry.panelId} names the fabric ${entry.fabricId}, which does not exist.`));
    }
  });
  for (const id of repeats(spec.panelFabrics.map((entry) => entry.panelId))) {
    found.push(problem(["panelFabrics"], `The panel ${id} has more than one fabric.`));
  }
  return found;
}

function colourwayProblems(spec: CheckedSpec, panels: ReadonlySet<string>): SpecProblem[] {
  const found = repeats(spec.colourways.map((colourway) => colourway.id)).map((id) =>
    problem(["colourways"], `The colourway id ${id} is used more than once.`),
  );
  spec.colourways.forEach((colourway, index) => {
    for (const entry of colourway.colours.filter((colour) => !panels.has(colour.panelId))) {
      found.push(
        problem(
          ["colourways", index, "colours"],
          `Colourway ${colourway.name} has a colour for ${entry.panelId}, which this garment does not have.`,
        ),
      );
    }
  });
  return found;
}

/** Says why artwork cannot sit where it is, or null when it fits. */
export function artworkProblem(art: Artwork, type: ResolvedType, spec: CheckedSpec): string | null {
  const panel = type.panels.find((entry) => entry.id === art.panelId);
  if (!panel || !conditionsHold(panel.appliesWhen, spec.options)) {
    return `Artwork ${art.id} is on ${art.panelId}, which this garment does not have.`;
  }
  if (panel.anchors.length === 0) {
    return `Artwork ${art.id} is on ${panel.label}, which cannot carry artwork.`;
  }
  if (!panel.anchors.some((anchor) => anchor.id === art.anchor)) {
    return `Artwork ${art.id} uses ${art.anchor}, which is not a place on ${panel.label}.`;
  }
  return null;
}

function artworkProblems(spec: CheckedSpec, type: ResolvedType): SpecProblem[] {
  const found = repeats(spec.artwork.map((art) => art.id)).map((id) =>
    problem(["artwork"], `The artwork id ${id} is used more than once.`),
  );
  spec.artwork.forEach((art, index) => {
    const message = artworkProblem(art, type, spec);
    if (message) found.push(problem(["artwork", index], message));
  });
  return found;
}

/**
 * Checks what the shape of a spec cannot: that it fits the registry. Returns every
 * problem found, or an empty list when the spec is valid.
 */
export function specProblems(spec: CheckedSpec): SpecProblem[] {
  const type = getType(spec.typeId);
  if (!type) return [problem(["typeId"], `There is no garment type called ${spec.typeId}.`)];
  const panels = new Set(
    type.panels.filter((panel) => conditionsHold(panel.appliesWhen, spec.options)).map((p) => p.id),
  );
  return [
    ...(type.wearers.includes(spec.wearer) ? [] : [problem(["wearer"], `${type.label} is not made for ${spec.wearer}.`)]),
    ...optionProblems(spec, type),
    ...checkCombination(spec.typeId, spec.options).map((violation) => problem(["options"], violation.reason)),
    ...measurementProblems(spec, type),
    ...fabricProblems(spec, panels),
    ...colourwayProblems(spec, panels),
    ...artworkProblems(spec, type),
  ];
}
