import type { ArticleFabric, BaseArticle } from "@/lib/catalogue/types";
import type { Capability, FabricColour, ProgrammeFabric } from "@/lib/factory/schemas";
import { GAP_RULE_ID } from "@/lib/factory/schemas";

/**
 * The article page (spec F-S8): the pictures, the fabrics with their spec cards, the size chart, the
 * fit notes, the care words and the lead time. The price ladder is in `price.ts`.
 *
 * Nothing on this page is stated as a settled factory fact. There are no sample photographs yet, so
 * the picture says "Render, not photo"; a value no row holds reads "Not set yet" and carries the
 * rulebook id that would explain it, or `R-GAP-000` where the rulebook has no entry.
 */

/** Shown over every picture until a sample has been photographed (plan v5 Y1). */
export const RENDER_NOTICE = {
  label: "Render, not photo",
  note: "No sample of this article has been photographed. The picture is a placeholder outline, not this garment.",
} as const;

/** What a field reads when no row holds it. */
export const NOT_SET = "Not set yet";

export interface FabricCard {
  readonly code: string;
  readonly name: string;
  /** "Body" or "Rib" where the article says which, otherwise null. */
  readonly role: string | null;
  readonly blend: string;
  readonly gsm: string;
  readonly width: string;
  readonly stretch: string;
  readonly finish: string;
  readonly sublimation: string;
  readonly colours: readonly Readonly<{ name: string; hex: string }>[];
  /** The article's own words about the fabric, where it has any. */
  readonly description: string | null;
  /** Says so where the fabric is not one of the fabric programme's rows. */
  readonly note: string | null;
  readonly label: string;
  readonly ruleId: string;
}

const text = (value: string | null | undefined): string => (value === null || value === undefined || value.trim() === "" ? NOT_SET : value);

const gsmOf = (programme: ProgrammeFabric | undefined, fabric: ArticleFabric): string => {
  if (programme?.gsmMin !== null && programme?.gsmMin !== undefined) {
    const { gsmMin, gsmMax } = programme;
    return gsmMax === null || gsmMax === gsmMin ? `${gsmMin} g/m²` : `${gsmMin}–${gsmMax} g/m²`;
  }
  return fabric.gsm === null ? NOT_SET : `${fabric.gsm} g/m²`;
};

const sublimationOf = (programme: ProgrammeFabric | undefined): string => {
  if (programme === undefined || programme.sublimatable === null) return NOT_SET;
  return programme.sublimatable ? "Takes a sublimation print" : "Not for sublimation";
};

const ROLE_LABELS: Readonly<Record<string, string>> = { body: "Body", rib: "Rib" };

/**
 * One fabric of the article as a spec card: the article's own row joined to the fabric programme's
 * row (X6, decision 0071) and its stock colours. A fabric the programme has no row for says so.
 */
export function fabricCard(
  fabric: ArticleFabric,
  programme: readonly ProgrammeFabric[],
  colours: readonly FabricColour[],
): FabricCard {
  const row = programme.find((entry) => entry.code === fabric.code);
  return {
    code: fabric.code,
    name: row?.name ?? fabric.code,
    role: fabric.role === null ? null : (ROLE_LABELS[fabric.role] ?? fabric.role),
    blend: text(row?.blend),
    gsm: gsmOf(row, fabric),
    width: fabric.widthCm === null ? NOT_SET : `${fabric.widthCm} cm`,
    stretch: text(row?.stretch),
    finish: text(row?.finish),
    sublimation: sublimationOf(row),
    colours: colours.filter((colour) => colour.fabricCode === fabric.code).map(({ name, hex }) => ({ name, hex })),
    description: fabric.description,
    note: row === undefined ? "This fabric is not one of the fabric programme's rows yet, so only the article's own words are shown." : null,
    label: row?.label ?? fabric.sourceNote ?? "Knitwright draft, not reviewed by a factory",
    ruleId: row?.ruleId ?? GAP_RULE_ID,
  };
}

export interface SizeChartRow {
  readonly letter: string;
  readonly code: string;
  readonly description: string;
  readonly gradeType: string;
  readonly grade: string;
  readonly tolerance: string;
  /** One cell per size, in the article's size order; null where that size has no value. */
  readonly values: readonly (number | null)[];
  readonly ruleId: string;
}

export interface SizeChart {
  readonly sizes: readonly string[];
  readonly sampleSize: string | null;
  readonly rows: readonly SizeChartRow[];
  /** Why the chart is empty, or null when it has rows. */
  readonly empty: string | null;
}

const GRADE_TYPE_LABELS: Readonly<Record<string, string>> = {
  linear: "Linear",
  non_linear: "Not linear",
  ungraded: "Not graded",
  fixed: "Same in every size",
};

/** The article's own finished measurements, in millimetres, one column per size. */
export function sizeChart(article: BaseArticle): SizeChart {
  const sizes = article.sizeRange;
  return {
    sizes,
    sampleSize: article.sampleSize,
    rows: article.poms.map((pom) => ({
      letter: pom.letter,
      code: pom.code,
      description: pom.description,
      gradeType: GRADE_TYPE_LABELS[pom.gradeType] ?? pom.gradeType,
      grade: pom.gradeType === "ungraded" || pom.gradeType === "fixed" ? "—" : `${pom.gradeMm} mm`,
      tolerance: `−${pom.tolMinusMm} / +${pom.tolPlusMm} mm`,
      values: sizes.map((size) => pom.valuesMm[size] ?? null),
      ruleId: pom.ruleId,
    })),
    empty:
      article.poms.length === 0
        ? "This article has no measurements on file yet. The build pack gives them for the worked article only."
        : null,
  };
}

export interface FitNote {
  readonly label: string;
  readonly value: string;
  readonly ruleId: string;
}

/** "Body length offset" from "body_length_offset". */
const parameterLabel = (key: string): string => {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const rangeText = (min: number | null, max: number | null, unit: string | null): string => {
  if (min === null || max === null) return NOT_SET;
  const suffix = unit === null ? "" : ` ${unit}`;
  return `${min} to ${max}${suffix}`;
};

/**
 * The fit: what the article is cut as, and every length a founder may move, with the range on file
 * and the rule that explains it (spec F-S8 "fit notes"; manufacturable by construction).
 */
export function fitNotes(article: BaseArticle): readonly FitNote[] {
  const fit: FitNote = { label: "Cut", value: article.fit === null ? NOT_SET : article.fit, ruleId: GAP_RULE_ID };
  const ranges = article.parameters
    .filter((parameter) => parameter.type === "range")
    .map((parameter) => ({
      label: parameterLabel(parameter.key),
      value: `${rangeText(parameter.min, parameter.max, parameter.unit ?? "mm")}${parameter.approvedBySampleId === null ? " · Not yet sampled" : ""}`,
      ruleId: parameter.ruleId,
    }));
  return [fit, ...ranges];
}

/**
 * The care words. The build pack writes none for any article, and R-LAB-002 (fibre, care and origin
 * per destination market) has no text yet, so the page says so rather than inventing a wash symbol.
 */
export const careNote = (): FitNote => ({
  label: "Care",
  value: "No care wording is on file. It is written per destination market when the label rules are.",
  ruleId: GAP_RULE_ID,
});

export interface LeadTime {
  readonly value: string;
  readonly label: string;
  readonly ruleId: string;
}

/** The factory's lead time for this article, as working days from the weekly cut-off. */
export function leadTime(capability: Capability | undefined): LeadTime {
  if (capability === undefined || capability.leadTimeDays === null) {
    return { value: "No lead time is on file for this article yet.", label: "", ruleId: GAP_RULE_ID };
  }
  return {
    value: `${capability.leadTimeDays} working days from the weekly cut-off, before QC and freight.`,
    label: capability.label,
    ruleId: capability.ruleId,
  };
}
