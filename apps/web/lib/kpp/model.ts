import type { GradedPattern } from "@/lib/production/contract";

/**
 * What the production package is made from (docs/spec/04-production-package.md, decision 0070).
 * It is plain, already-resolved data: one design version, one factory, and for a batch the
 * orders. Every value a factory reads carries where it came from (`provenance`) and the rule
 * that explains it (`ruleId`). A field still `needs_input`, or any text holding `[TBC]`, stops
 * the package being built (F-G2).
 */

/** The spec's provenance words (docs/spec/04, "Every field carries provenance"). */
export const FIELD_PROVENANCE = ["from_base", "from_design", "needs_input", "confirmed"] as const;
export type FieldProvenance = (typeof FIELD_PROVENANCE)[number];

/** The rule id used where no rulebook entry exists yet (plan v5, "Every rule explains itself"). */
export const GAP_RULE = "R-GAP-000";

export interface KppField {
  readonly id: string;
  readonly label: string;
  /** Null while nobody has filled it in. */
  readonly value: string | null;
  readonly provenance: FieldProvenance;
  readonly ruleId: string;
}

export interface KppDesign {
  /** The style code; it names the package folder. */
  readonly code: string;
  readonly name: string;
  readonly articleCode: string;
  readonly version: number;
  /** sha256 of the design version, as the credits gate and the manifest name it. */
  readonly hash: string;
  /** When the version was saved. Every PDF date and every ZIP entry time is pinned to it. */
  readonly createdAtIso: string;
  readonly brand: string;
  readonly season: string | null;
  readonly baseSize: string;
  /** In grading order. */
  readonly sizes: readonly string[];
}

export const NOTCH_STYLES = ["v-notch", "slit"] as const;
export const PRINT_FILE_TYPES = ["pdf", "tif"] as const;

export interface KppFactory {
  readonly code: string;
  readonly name: string;
  /** Who the factory asks, in words. Null while not set. */
  readonly contact: string | null;
  readonly notch: (typeof NOTCH_STYLES)[number];
  readonly printFileType: (typeof PRINT_FILE_TYPES)[number];
  /** True when Knitwright makes the order, so the package is free (spec decision 9). */
  readonly madeByKnitwright: boolean;
}

/**
 * How a point of measure grades. `linear`, `non_linear` and `ungraded` are the words X1's
 * `article_poms` uses; `fixed` is the extra one `pom.csv` shows in docs/spec/04 (an inseam that
 * does not grade). They are written into `pom.csv` as they stand here.
 */
export const GRADE_TYPES = ["linear", "non_linear", "fixed", "ungraded"] as const;

export interface KppPom {
  readonly letter: string;
  readonly code: string;
  readonly description: string;
  readonly gradeType: (typeof GRADE_TYPES)[number];
  readonly gradeMm: number | null;
  readonly tolMinusMm: number | null;
  readonly tolPlusMm: number | null;
  /** Millimetres per size label; null while not known. */
  readonly values: Readonly<Record<string, number | null>>;
  readonly ruleId: string;
  readonly provenance: FieldProvenance;
}

export interface KppBomRow {
  readonly item: string;
  readonly type: "fabric" | "thread" | "trim" | "label" | "packaging";
  readonly spec: string | null;
  readonly supplierRef: string | null;
  readonly qtyPerPiece: string | null;
  readonly unit: string | null;
  readonly sizeDependent: boolean;
  readonly ruleId: string;
  readonly provenance: FieldProvenance;
}

export interface KppColour {
  readonly role: string;
  readonly hex: string | null;
  readonly pantoneTcx: string | null;
  readonly swatchId: string | null;
}

export interface KppColourSpec {
  readonly fabric: string | null;
  /**
   * The colour difference the factory has agreed it can hold. Null when none is agreed: the package never states a
   * tolerance nobody agreed to, and the gate refuses instead. Owner decision 15: until the colour house states its
   * white point, delta E is defined against our own figures, which are sRGB under D65 with the two-degree observer.
   */
  readonly tolerance: Readonly<{ metric: "dE_CMC_2_1"; max: number | null }>;
  readonly colours: readonly KppColour[];
  readonly strikeOffRequired: boolean;
  readonly ruleId: string;
}

export interface KppLabel {
  /** A destination market code, such as `uk` or `au`. */
  readonly market: string;
  readonly fibre: string | null;
  readonly care: readonly string[];
  readonly origin: string | null;
  readonly size: string | null;
  /** Importer or brand name and address, where the market requires one; null when not required. */
  readonly importer: string | null;
  readonly importerRequired: boolean;
  readonly ruleId: string;
}

export interface KppQc {
  readonly aqlPlan: string;
  /** POM letters to measure. */
  readonly measure: readonly string[];
  readonly colour: string;
  readonly visual: readonly string[];
  readonly photos: readonly string[];
  readonly ruleId: string;
}

/** The thresholds the print files are checked against (from the base article's rules). */
export interface KppPrintRules {
  readonly minDpi: number;
  readonly minBleedMm: number;
  /** What the factory profile asks for. */
  readonly dpi: number;
  readonly bleedMm: number;
  readonly ruleId: string;
}

export interface KppNameNumber {
  readonly orderNo: string;
  readonly lineId: string;
  readonly size: string;
  readonly name: string;
  readonly number: string;
  readonly nameZone: string;
  readonly numberZone: string;
  readonly fontId: string;
  readonly colourHex: string;
}

export interface KppOrder {
  readonly orderNo: string;
  /** Pieces per size label. */
  readonly sizes: Readonly<Record<string, number>>;
  readonly dueDate: string | null;
}

/** The moderation status of the design (F-G1). `not_built` until that check exists; it is reported, not refused. */
export const MODERATION = ["clear", "flagged", "pending", "not_built"] as const;

export interface KppInput {
  readonly kind: "sample" | "batch";
  readonly design: KppDesign;
  readonly factory: KppFactory;
  readonly dueDate: string | null;
  /** Header and overview fields: style details, season, factory, class and the like. */
  readonly fields: readonly KppField[];
  readonly poms: readonly KppPom[];
  readonly bom: readonly KppBomRow[];
  readonly colour: KppColourSpec;
  readonly labels: readonly KppLabel[];
  readonly qc: KppQc;
  readonly print: KppPrintRules;
  readonly moderation: (typeof MODERATION)[number];
  /** Batch packages only. */
  readonly orders: readonly KppOrder[];
  readonly personalisation: readonly KppNameNumber[];
  readonly packing: readonly string[];
  /** Sentences the README carries, such as "no ICC profile: left as sRGB". */
  readonly notes: readonly string[];
}

/** A print file for one panel at one size. */
export interface PanelPrintFile {
  readonly panel: string;
  readonly bytes: Uint8Array;
}

/**
 * The graded pattern pieces. `sources/pattern.ts` draws them from the graded drafter (lib/parametric,
 * decision 0068); the pattern library's synthetic run stays on as the fixture's test double.
 */
export interface PatternSource {
  pattern(): Promise<GradedPattern>;
}

/** The existing print builder (lib/print), per size, and per order for a batch. */
export interface PrintSource {
  files(size: string, orderNo: string | null): Promise<readonly PanelPrintFile[]>;
}

/** The existing tech pack PDF (lib/techpack/exports). Its dates are pinned by the assembler. */
export interface TechPackPdfSource {
  pdf(): Promise<Uint8Array>;
}

/** Deterministic front and back renders as JPEG, or null while there is no server renderer. */
export interface RenderSource {
  frontBack(): Promise<Readonly<{ front: Uint8Array; back: Uint8Array }> | null>;
}

export interface KppSources {
  readonly pattern: PatternSource;
  readonly print: PrintSource;
  readonly techpack: TechPackPdfSource;
  readonly renders: RenderSource;
  /** A brand label PDF, when the brand gave one. */
  readonly brandLabelPdf?: Uint8Array;
  /** The approved golden sample's report, when there is one. */
  readonly goldenSamplePdf?: Uint8Array;
}
