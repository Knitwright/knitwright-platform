import type { ArticleStatus, ArticleUse, FabricRole, GradeType, ParameterType, ProductionClass } from "./vocabulary";

/** One point of measure with its grade, tolerance and value in every size, in millimetres. */
export type ArticlePom = Readonly<{
  letter: string;
  code: string;
  description: string;
  gradeType: GradeType;
  gradeMm: number;
  tolMinusMm: number;
  tolPlusMm: number;
  valuesMm: Readonly<Record<string, number>>;
  ruleId: string;
}>;

/** A structural parameter and the range a factory makes. `approvedBySampleId` is null until a sample exists at its ends. */
export type ParameterDef = Readonly<{
  key: string;
  type: ParameterType;
  min: number | null;
  max: number | null;
  step: number | null;
  defaultValue: number | string | boolean;
  enumValues: readonly string[] | null;
  unit: string | null;
  affectsPanels: readonly string[];
  pomLetters: readonly string[];
  ruleId: string;
  approvedBySampleId: string | null;
}>;

/** A discrete option with its catalogue code (collar `C01`, sleeve finish `K01`, pattern fill `P00`). */
export type OptionDef = Readonly<{
  group: string;
  code: string;
  label: string;
  isDefault: boolean;
  thumbnailKey: string | null;
  /** Null until the price is set: an option is never shown as free because nobody priced it. */
  extraCostMinor: number | null;
  currency: string | null;
  /** `R-GAP-000` where the source article names no rule (the pattern fills of JSY-SS-01), never nothing. */
  ruleId: string;
  approvedBySampleId: string | null;
}>;

/** One row of the construction table: a seam and how it is sewn. */
export type ConstructionStep = Readonly<{
  step: number;
  seam: string;
  operation: string;
  /** ISO 4915 stitch classes named in the operation, as `514`. */
  isoStitchClasses: readonly string[];
  spi: string | null;
  ruleId: string;
}>;

/** A fabric the article may be made in. Only the code is known for an article still in draft. */
export type ArticleFabric = Readonly<{
  code: string;
  role: FabricRole | null;
  description: string | null;
  gsm: string | null;
  widthCm: number | null;
  pressShrinkLengthPct: number | null;
  pressShrinkWidthPct: number | null;
  sourceNote: string | null;
}>;

export type ThreadSpec = Readonly<{ needle: string; looper: string; ruleId: string }>;
export type SeamAllowances = Readonly<{ mm: Readonly<Record<string, number>>; ruleId: string }>;

/** The catalogue's view of a base article: what the browse list shows. */
export type BaseArticleSummary = Readonly<{
  code: string;
  name: string;
  articleType: string;
  productionClass: ProductionClass;
  status: ArticleStatus;
  sportTags: readonly string[];
  uses: readonly ArticleUse[];
  fit: string | null;
  genders: readonly string[];
  sizeRange: readonly string[];
  sampleSize: string | null;
  registryTypeId: string | null;
  fabricCodes: readonly string[];
  dataLabel: string;
}>;

/** A whole base article: the makeable block with everything the editor and the tech pack read. */
export type BaseArticle = Readonly<
  Omit<BaseArticleSummary, "fabricCodes"> & {
    hsCode: string | null;
    origin: string | null;
    sourceVersion: string | null;
    sourceNote: string | null;
    glbModelKey: string | null;
    uvPanelMap: unknown;
    parametricScriptId: string | null;
    parametricScriptVersion: string | null;
    seamAllowances: SeamAllowances | null;
    thread: ThreadSpec | null;
    poms: readonly ArticlePom[];
    parameters: readonly ParameterDef[];
    options: readonly OptionDef[];
    construction: readonly ConstructionStep[];
    fabrics: readonly ArticleFabric[];
  }
>;
