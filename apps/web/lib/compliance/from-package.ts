import type { KppBomRow, KppColourSpec, KppInput, KppPom } from "@/lib/kpp/model";
import type { DestinationLabel } from "./labels";
import { GAP_RULE_ID, type ModerationState, type ProductionClass } from "./model";
import { tbcPathsOf, type BomLine, type ColourState, type GapField, type PomState, type PreExportSubject } from "./subject";

/**
 * The production package as the one checklist reads it (decision 0070's `KppInput`, decision 0089's subject).
 * `lib/kpp/gate.ts` holds the package's own copy of the same checks; this adapter is what lets that copy be
 * deleted, and `from-package.test.ts` proves the two agree issue for issue before anyone does.
 *
 * The labels are passed in rather than read out of `KppInput`. `KppInput.labels` is already flattened text
 * with no source beside it, and the whole point of `labels.ts` is that a label line carries where its words
 * came from. The caller builds them from `country_rules`, `programme_fabrics` and `care_symbols`, which is the
 * wiring Lesson 9 leaves to the orchestrator.
 */

export interface PackageSubjectExtras {
  readonly labels: readonly DestinationLabel[];
  /** The base article's production class (decision 0066). Null: no base article covers the design. */
  readonly productionClass: ProductionClass;
  /** Whether a person has allowed this design version (X8). Null: nobody has been asked. */
  readonly humanAllowed: boolean | null;
}

const gapOf = (field: KppInput["fields"][number]): GapField => ({ path: `fields.${field.id}`, label: field.label, ruleId: field.ruleId });

const blank = (value: string | null | undefined): boolean => value === null || value === undefined || value.trim() === "";

const pomState = (pom: KppPom, sizes: readonly string[]): PomState => ({
  letter: pom.letter,
  description: pom.description,
  missingSizes: sizes.filter((size) => pom.values[size] === null || pom.values[size] === undefined),
  hasTolerance: pom.tolMinusMm !== null && pom.tolPlusMm !== null,
  needsInput: pom.provenance === "needs_input",
  ruleId: pom.ruleId,
});

/** The same words `lib/kpp/gate.ts` uses for a BOM line's gaps, so the two lists can be compared. */
const bomLine = (row: KppBomRow): BomLine => ({
  item: row.item,
  kind: row.type,
  gaps: [
    row.provenance === "needs_input" ? "needs your input" : null,
    blank(row.spec) ? "no specification" : null,
    blank(row.qtyPerPiece) ? "no quantity" : null,
    blank(row.unit) ? "no unit" : null,
  ].filter((gap): gap is string => gap !== null),
  ruleId: row.ruleId,
});

const colourState = (spec: KppColourSpec): ColourState => ({
  fabric: blank(spec.fabric) ? null : spec.fabric,
  roles: spec.colours.map((colour) => ({ role: colour.role, hex: colour.hex, pantoneTcx: colour.pantoneTcx, swatchId: colour.swatchId })),
  toleranceMax: spec.tolerance.max,
  ruleId: spec.ruleId,
});

/** `KppInput.moderation` has no `blocked` word; a blocked design never reaches a package input. */
const moderationState = (state: KppInput["moderation"]): ModerationState => state;

/**
 * Batch packages carry orders, and `lib/kpp/gate.ts` checks that every order's sizes are in the size run.
 * That is a check on the batch, not on the garment's compliance, so it stays in the package's own code and is
 * reported here as a needs-input gap rather than being silently dropped.
 */
function orderGaps(input: KppInput): readonly GapField[] {
  if (input.kind !== "batch") return [];
  if (input.orders.length === 0) return [{ path: "orders", label: "Batch orders", ruleId: GAP_RULE_ID }];
  const known = new Set(input.design.sizes);
  return input.orders.flatMap((order, index) => {
    const unknown = Object.keys(order.sizes).filter((size) => !known.has(size));
    return unknown.length === 0 ? [] : [{ path: `orders[${index}]`, label: `Order ${order.orderNo}: size ${unknown.join(", ")} is not in the size run`, ruleId: GAP_RULE_ID }];
  });
}

export function subjectFromPackage(input: KppInput, extras: PackageSubjectExtras): PreExportSubject {
  return {
    source: "package",
    needsInput: [...input.fields.filter((field) => field.provenance === "needs_input" || blank(field.value)).map(gapOf), ...orderGaps(input)],
    tbcPaths: tbcPathsOf(input),
    poms: input.poms.map((pom) => pomState(pom, input.design.sizes)),
    sizes: input.design.sizes,
    bom: input.bom.map(bomLine),
    colour: colourState(input.colour),
    labels: extras.labels,
    print: {
      dpi: input.print.dpi,
      minDpi: input.print.minDpi,
      bleedMm: input.print.bleedMm,
      minBleedMm: input.print.minBleedMm,
      ruleId: input.print.ruleId,
    },
    moderation: { state: moderationState(input.moderation), productionClass: extras.productionClass, humanAllowed: extras.humanAllowed },
  };
}
