import { componentSlotsFor, seamClassById, seamsFor, stitchClassById } from "./construction";
import type { ComponentEntry, ConstructionEntry } from "./tech-parts";
import type { ResolvedType } from "./registry";
import type { SpecShape } from "./applicability";

/** One thing wrong with the tech pack fields of a spec, and where. Same shape as a spec problem. */
interface TechProblem {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

const problem = (path: readonly (string | number)[], message: string): TechProblem => ({ path, message });

function repeats(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const again: string[] = [];
  for (const value of values) {
    if (seen.has(value)) again.push(value);
    seen.add(value);
  }
  return again;
}

function componentProblems(entries: readonly ComponentEntry[], shape: SpecShape, type: ResolvedType): TechProblem[] {
  const applying = new Set(componentSlotsFor(shape).map((slot) => slot.id));
  const found = entries.flatMap((entry, index) => {
    const slot = type.components.find((candidate) => candidate.id === entry.id);
    const path = ["components", index, "id"];
    if (!slot) return [problem(path, `${entry.id} is not a component of ${type.label}.`)];
    return applying.has(entry.id) ? [] : [problem(path, `${slot.label} does not apply to this garment.`)];
  });
  const again = repeats(entries.map((entry) => entry.id)).map((id) =>
    problem(["components"], `${id} is listed more than once.`),
  );
  return [...found, ...again];
}

function classProblems(entry: ConstructionEntry, index: number): TechProblem[] {
  const found: TechProblem[] = [];
  if (entry.seamClass !== undefined && !seamClassById(entry.seamClass)) {
    found.push(problem(["construction", index, "seamClass"], `${entry.seamClass} is not a seam class.`));
  }
  if (entry.stitchClass !== undefined && !stitchClassById(entry.stitchClass)) {
    found.push(problem(["construction", index, "stitchClass"], `${entry.stitchClass} is not a stitch class.`));
  }
  return found;
}

function constructionProblems(
  entries: readonly ConstructionEntry[],
  shape: SpecShape,
  type: ResolvedType,
): TechProblem[] {
  const applying = new Set(seamsFor(shape).map((seam) => seam.id));
  const found = entries.flatMap((entry, index) => {
    const seam = type.seams.find((candidate) => candidate.id === entry.seamId);
    const path = ["construction", index, "seamId"];
    const own = !seam
      ? [problem(path, `${entry.seamId} is not a seam of ${type.label}.`)]
      : applying.has(entry.seamId)
        ? []
        : [problem(path, `${seam.label} does not apply to this garment.`)];
    return [...own, ...classProblems(entry, index)];
  });
  const again = repeats(entries.map((entry) => entry.seamId)).map((id) =>
    problem(["construction"], `${id} is listed more than once.`),
  );
  return [...found, ...again];
}

/** Checks the components and construction entries of a spec against the registry. */
export function techProblems(
  spec: SpecShape & { readonly components: readonly ComponentEntry[]; readonly construction: readonly ConstructionEntry[] },
  type: ResolvedType,
): TechProblem[] {
  return [
    ...componentProblems(spec.components, spec, type),
    ...constructionProblems(spec.construction, spec, type),
  ];
}
