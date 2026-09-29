import { SCHEMATIC_CHEST, type MissingPoint } from "./model";

/** Each measurement as a ratio of the chest width. Ratios, never lengths. */
export type Proportions = Readonly<Record<string, number>>;

export type Dims = Readonly<Record<string, number>>;

export interface ResolvedDimensions {
  /** One number, in tenths of a millimetre, for every point in the proportions. */
  readonly dims: Dims;
  readonly toScale: boolean;
  readonly missing: readonly MissingPoint[];
  readonly problems: readonly string[];
}

export interface DimensionInput {
  /** The measurements the drawing needs: the points that apply to the design. */
  readonly needed: readonly { readonly id: string; readonly label: string }[];
  /** The measurements that are present, by point id, in tenths of a millimetre. */
  readonly values: ReadonlyMap<string, number>;
  readonly proportions: Proportions;
  /** Says in plain words why a set of dimensions cannot be drawn. Empty when they can. */
  readonly check: (dims: Dims) => readonly string[];
}

/** A dimension the drawing needs. A missing one is a broken template and is never read as zero. */
export function need(dims: Dims, id: string): number {
  const value = dims[id];
  if (value === undefined) throw new Error(`The drawing needs "${id}" and the template has no proportion for it.`);
  return value;
}

const CHEST = "chest-width";

/** The size that turns ratios into lengths: the chest if known, else any measurement, else a nominal size. */
function anchorFor(values: ReadonlyMap<string, number>, proportions: Proportions): number {
  const chest = values.get(CHEST);
  if (chest !== undefined) return chest;
  for (const [id, ratio] of Object.entries(proportions)) {
    const value = values.get(id);
    if (value !== undefined && ratio > 0) return value / ratio;
  }
  return SCHEMATIC_CHEST;
}

const fromProportions = (proportions: Proportions, anchor: number): Dims =>
  Object.fromEntries(Object.entries(proportions).map(([id, ratio]) => [id, ratio * anchor]));

/**
 * Works out the numbers a template draws with. Measurements that are present are used as
 * they are. Any that are missing come from the template's proportions, so a drawing always
 * has a shape, and the result then says it is not to scale. When the measurements present
 * cannot be drawn together, all of it falls back to the proportions.
 */
export function resolveDimensions(input: DimensionInput): ResolvedDimensions {
  const { needed, values, proportions } = input;
  const usable = new Map([...values].filter(([id]) => Object.hasOwn(proportions, id)));
  const missing = needed.filter((point) => !usable.has(point.id)).map((point) => ({ pointId: point.id, label: point.label }));
  const anchor = anchorFor(usable, proportions);
  const scheme = fromProportions(proportions, anchor);
  const mixed: Dims = { ...scheme, ...Object.fromEntries(usable) };
  const problems = input.check(mixed);
  const dims = problems.length > 0 ? scheme : mixed;
  return { dims, toScale: missing.length === 0 && problems.length === 0, missing, problems };
}
