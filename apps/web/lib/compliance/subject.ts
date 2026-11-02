import type { DestinationLabel } from "./labels";
import type { ChecklistSource, ModerationState, ProductionClass } from "./model";

/**
 * The one shape the F-G2 checklist reads (decision 0089). The tech pack Review tab, the production package and
 * ordering each have their own data; `from-techpack.ts`, `from-package.ts` and `from-order.ts` turn it into
 * this, and the checklist itself knows nothing about any of them. That is what makes it one checklist rather
 * than three that drift.
 *
 * A field this shape cannot express is a field the checklist does not check, which is the point: a caller
 * cannot quietly weaken an item by passing a different kind of input.
 */

/** A field still "Needs your input" (the spec's provenance word), or empty. */
export interface GapField {
  /** Where it is, as a dotted path. */
  readonly path: string;
  /** What a person reads, such as "Style number". */
  readonly label: string;
  readonly ruleId: string;
}

export interface PomState {
  readonly letter: string;
  readonly description: string;
  /** Sizes with no value. */
  readonly missingSizes: readonly string[];
  /** False when either half of the tolerance is missing. Decision 18: a tolerance is never guessed. */
  readonly hasTolerance: boolean;
  readonly needsInput: boolean;
  readonly ruleId: string;
}

export interface BomLine {
  readonly item: string;
  readonly kind: "fabric" | "thread" | "trim" | "label" | "packaging";
  /** What is missing from the line, in words, such as "no quantity". Empty: the line is whole. */
  readonly gaps: readonly string[];
  readonly ruleId: string;
}

export interface ColourRole {
  readonly role: string;
  /** `#RRGGBB`, or null while not chosen. */
  readonly hex: string | null;
  readonly pantoneTcx: string | null;
  readonly swatchId: string | null;
}

export interface ColourState {
  /** Null: no fabric is named on the colour spec. */
  readonly fabric: string | null;
  readonly roles: readonly ColourRole[];
  /** The colour difference the factory has agreed. Null: none agreed (owner decision 15). */
  readonly toleranceMax: number | null;
  readonly ruleId: string;
}

export interface PrintState {
  readonly dpi: number;
  readonly minDpi: number;
  readonly bleedMm: number;
  readonly minBleedMm: number;
  readonly ruleId: string;
}

export interface ModerationSubject {
  readonly state: ModerationState;
  readonly productionClass: ProductionClass;
  /**
   * Whether a person has allowed this design version (X8 `humanAllowed`). Null: nobody has been asked, which
   * is refused for a Class B run exactly as a refusal is.
   */
  readonly humanAllowed: boolean | null;
}

export interface PreExportSubject {
  readonly source: ChecklistSource;
  readonly needsInput: readonly GapField[];
  /** Every path whose text holds `[TBC]`. */
  readonly tbcPaths: readonly string[];
  readonly poms: readonly PomState[];
  /** The size run the points of measure are expected for, in grading order. */
  readonly sizes: readonly string[];
  readonly bom: readonly BomLine[];
  readonly colour: ColourState;
  readonly labels: readonly DestinationLabel[];
  /** Null: this source has no print files to check. */
  readonly print: PrintState | null;
  readonly moderation: ModerationSubject;
}

/** Every string holding `[TBC]`, with its path, read out of any already-resolved input. */
export function tbcPathsOf(value: unknown, path = ""): readonly string[] {
  if (typeof value === "string") return value.toUpperCase().includes("[TBC]") ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((one, index) => tbcPathsOf(one, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .flatMap((key) => tbcPathsOf(record[key], path === "" ? key : `${path}.${key}`));
  }
  return [];
}
