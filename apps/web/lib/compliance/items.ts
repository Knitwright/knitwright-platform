import { isInsideApproxGamut } from "@/lib/guardrails/gamut";
import { blocker, GAP_RULE_ID, listOf, warning, type ChecklistItemId, type ComplianceFinding, type ProductionClass } from "./model";
import type { ModerationSubject, PreExportSubject } from "./subject";

/**
 * What each item of the F-G2 checklist checks (decision 0089). One function per item of the spec's list, in
 * the spec's order. Each returns findings; `checklist.ts` turns them into a pass, a warning or a refusal.
 *
 * `null` from `applies` means the item has nothing to check here and is reported as skipped with its reason.
 * A skipped item is never reported as passing: "no print files were checked" and "the print files passed" are
 * different sentences, and only one of them is true of a tech pack.
 */

export type ItemCheck = Readonly<{
  id: ChecklistItemId;
  /** Null when the item runs; a reason when it does not. */
  skip: (subject: PreExportSubject) => "not_in_this_source" | "nothing_to_check" | null;
  run: (subject: PreExportSubject) => readonly ComplianceFinding[];
}>;

const HEX = /^#[0-9A-Fa-f]{6}$/;

const needsInput: ItemCheck = {
  id: "needs_input",
  skip: () => null,
  run: (subject) =>
    subject.needsInput.map((gap) => blocker("needs_input", gap.path, `${gap.label}: needs your input.`, gap.ruleId)),
};

const tbc: ItemCheck = {
  id: "tbc",
  skip: () => null,
  run: (subject) =>
    subject.tbcPaths.map((path) => blocker("tbc", path, `${path} holds [TBC], which may not go to a factory.`, GAP_RULE_ID)),
};

const poms: ItemCheck = {
  id: "poms",
  skip: () => null,
  run: (subject) => {
    if (subject.poms.length === 0) return [blocker("poms_none", "poms", "Points of measure: none are listed.", GAP_RULE_ID)];
    return subject.poms.flatMap((pom): ComplianceFinding[] => {
      const named = `POM ${pom.letter} ${pom.description}`;
      return [
        ...(pom.needsInput ? [blocker("pom_needs_input", `poms.${pom.letter}`, `${named}: needs your input.`, pom.ruleId)] : []),
        ...(pom.missingSizes.length > 0
          ? [blocker("pom_no_value", `poms.${pom.letter}.values`, `${named}: no value for ${listOf([...pom.missingSizes])}.`, pom.ruleId)]
          : []),
        // Owner decision 18: a point of measure with no tolerance is a question for the factory, never a guess.
        ...(pom.hasTolerance ? [] : [blocker("pom_no_tolerance", `poms.${pom.letter}.tolerance`, `${named}: no tolerance.`, pom.ruleId)]),
      ];
    });
  },
};

const bom: ItemCheck = {
  id: "bom",
  skip: () => null,
  run: (subject) => {
    if (subject.bom.length === 0) return [blocker("bom_none", "bom", "Bill of materials: no lines.", GAP_RULE_ID)];
    const fabric = subject.bom.some((row) => row.kind === "fabric")
      ? []
      : [blocker("bom_no_fabric", "bom", "Bill of materials: no fabric line.", GAP_RULE_ID)];
    return [
      ...fabric,
      ...subject.bom.flatMap((row, index) =>
        row.gaps.length === 0 ? [] : [blocker("bom_incomplete", `bom[${index}]`, `BOM ${row.item}: ${listOf([...row.gaps])}.`, row.ruleId)],
      ),
    ];
  },
};

const labels: ItemCheck = {
  id: "labels",
  skip: () => null,
  run: (subject) =>
    subject.labels.length === 0
      ? [blocker("labels_none", "labels", "Labels: no destination market is chosen.", GAP_RULE_ID)]
      : subject.labels.flatMap((label) => label.findings),
};

/**
 * F-G2's gamut item is a warning, not a refusal, and `lib/kpp/gate.ts` already treats it that way for the
 * same reason: `lib/guardrails/gamut` is an estimate made without any print house's ICC profile, so it can
 * neither pass nor fail a colour truthfully. The sentence is carried to the factory instead.
 */
const colourGamut: ItemCheck = {
  id: "colour_gamut",
  // Never skipped. A design with no colour role at all is refused, not passed over: a factory cannot cut a
  // garment whose colours nobody named, and `lib/kpp/gate.ts` refuses the same thing.
  skip: () => null,
  run: (subject) => {
    const spec = subject.colour;
    const found: ComplianceFinding[] = spec.fabric === null ? [blocker("colour_no_fabric", "colour.fabric", "Colour spec: no fabric named.", spec.ruleId)] : [];
    if (spec.roles.length === 0) found.push(blocker("colour_no_roles", "colour.roles", "Colour spec: no colour roles.", spec.ruleId));
    // Owner decision 15: a colour difference nobody agreed is not written into a package.
    if (spec.toleranceMax === null) {
      found.push(blocker("colour_no_tolerance", "colour.tolerance", "Colour spec: no colour difference has been agreed with this factory.", spec.ruleId));
    }
    spec.roles.forEach((role, index) => {
      const gaps = [
        role.hex === null || !HEX.test(role.hex) ? "no valid hex" : null,
        role.pantoneTcx === null ? "no Pantone TCX" : null,
        role.swatchId === null ? "no swatch ID" : null,
      ].filter((gap): gap is string => gap !== null);
      if (gaps.length > 0) found.push(blocker("colour_incomplete", `colour.roles[${index}]`, `Colour ${role.role}: ${listOf(gaps)}.`, spec.ruleId));
      if (role.hex !== null && HEX.test(role.hex) && !isInsideApproxGamut(role.hex)) {
        found.push(
          warning(
            "colour_outside_gamut",
            `colour.roles[${index}]`,
            `Colour ${role.role} (${role.hex}) is very saturated and may print duller on fabric. This is Knitwright's estimate, not a measurement: match the strike-off, not the screen.`,
            spec.ruleId,
          ),
        );
      }
    });
    return found;
  },
};

const dpi: ItemCheck = {
  id: "dpi",
  skip: (subject) => (subject.print === null ? "not_in_this_source" : null),
  run: (subject) => {
    const print = subject.print!;
    return print.dpi < print.minDpi
      ? [blocker("dpi_too_low", "print.dpi", `Print files: ${print.dpi} DPI is below the ${print.minDpi} DPI the rules ask for.`, print.ruleId)]
      : [];
  },
};

const bleed: ItemCheck = {
  id: "bleed",
  skip: (subject) => (subject.print === null ? "not_in_this_source" : null),
  run: (subject) => {
    const print = subject.print!;
    return print.bleedMm < print.minBleedMm
      ? [blocker("bleed_too_small", "print.bleedMm", `Print files: ${print.bleedMm} mm bleed is below the ${print.minBleedMm} mm the rules ask for.`, print.ruleId)]
      : [];
  },
};

const MODERATION_WORDS: Readonly<Record<string, string>> = {
  blocked: "Moderation: the design was blocked and may not be made.",
  flagged: "Moderation: the design is flagged and must be cleared first.",
  pending: "Moderation: the check has not finished.",
};

const moderation: ItemCheck = {
  id: "moderation",
  skip: () => null,
  run: (subject) => {
    const { state } = subject.moderation;
    const words = MODERATION_WORDS[state];
    if (words !== undefined) return [blocker(`moderation_${state}`, "moderation", words, GAP_RULE_ID)];
    return state === "not_built"
      ? [warning("moderation_not_built", "moderation", "The design has not been through a moderation check: none exists for it yet.", GAP_RULE_ID)]
      : [];
  },
};

/** A Class B run needs a person's decision (F-G1). Any other class does not. */
export const requiresHumanReview = (productionClass: ProductionClass): boolean => productionClass === "B";

/**
 * The Class B human-review gate of F-G1 ("human review before any Class B run"), enforced before a run is
 * handed off. This is a genuine block, and it is not the 50 to 300 piece range: that range is a flag on the
 * quantity, and `lib/make/run.ts` owns it.
 */
export function classBReviewFinding(moderation: ModerationSubject): ComplianceFinding | null {
  if (!requiresHumanReview(moderation.productionClass) || moderation.humanAllowed === true) return null;
  const because =
    moderation.humanAllowed === null
      ? "A Class B run needs one of us to look at this design first, and nobody has been asked yet."
      : "A Class B run needs one of us to look at this design first. It is in the review queue.";
  return blocker("class_b_human_review_required", "moderation.humanReview", because, GAP_RULE_ID);
}

const classBHumanReview: ItemCheck = {
  id: "class_b_human_review",
  skip: (subject) => (requiresHumanReview(subject.moderation.productionClass) ? null : "nothing_to_check"),
  run: (subject) => {
    const found = classBReviewFinding(subject.moderation);
    return found === null ? [] : [found];
  },
};

/** The checklist, in the order `docs/spec/02-features.md` lists F-G2, with the two guardrails after it. */
export const ITEM_CHECKS: readonly ItemCheck[] = [
  needsInput,
  tbc,
  poms,
  bom,
  labels,
  colourGamut,
  dpi,
  bleed,
  moderation,
  classBHumanReview,
];
