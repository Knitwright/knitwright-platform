import type { DestinationLabelInput } from "../labels";
import { destinationLabel } from "../labels";
import type { FabricFacts } from "../guards";
import type { AqlPlan, CareSymbol } from "../rows";
import type { PreExportSubject } from "../subject";

/**
 * TEST FIXTURE ONLY (plan v5 Z8, decision 0089).
 *
 * `SEEDED_*` is the state `20261120070000_compliance.sql` really leaves the database in, quoted here so a unit
 * test can prove what the seed does and does not allow. `rows.test.ts` checks each one against the migration
 * file itself, so the two cannot drift.
 *
 * `written*` is a market whose wording someone has finished: the shape the rows take once the owner's
 * questions are answered. Nothing in it is presented as a real legal requirement, and nothing reads it but
 * these tests: it exists so the happy path is tested before the data exists, not so a label can be printed
 * from it.
 */

/** `country_rules.label_rules` for GB and AU, exactly as the migration writes it. */
export const SEEDED_LABEL_RULES_GB: Readonly<Record<string, unknown>> = {
  version: 1,
  label: "Knitwright draft v0.1, not reviewed by a factory or a legal adviser",
  origin: "Made in Pakistan",
  lines: {
    fibre: {
      text: null,
      language: "en",
      order: "descending_percentage",
      confirmed: false,
      source: "Rulebook R-LAB-002 (draft): UK Textile Products regulations. Confirm with a legal consult",
    },
    care: { symbolCodes: [], confirmed: false, source: null },
    origin: { text: "Made in Pakistan", confirmed: false, source: "docs/spec/04-production-package.md, section 07_labels" },
    size: { text: null, confirmed: false, source: null },
    importer: { text: null, required: null, confirmed: false, source: null },
  },
};

/** `country_rules.label_rules` for the United States: closed, and CPSIA testing required. */
export const SEEDED_LABEL_RULES_US: Readonly<Record<string, unknown>> = {
  version: 1,
  label: "Market closed at launch. No label wording is written: a sale here needs CPSIA testing, which does not exist (spec F-G3).",
  cpsiaRequired: true,
  cpsiaSource: "docs/spec/02-features.md, F-G3",
  lines: {
    fibre: { text: null, language: null, order: null, confirmed: false, source: null },
    care: { symbolCodes: [], confirmed: false, source: null },
    origin: { text: null, confirmed: false, source: null },
    size: { text: null, confirmed: false, source: null },
    importer: { text: null, required: null, confirmed: false, source: null },
  },
};

const uuid = (n: number): string => `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`;

/** The five ISO 3758 categories, with no symbol and no instruction: what the migration seeds. */
export const SEEDED_CARE_SYMBOLS: readonly CareSymbol[] = (
  [
    ["ISO3758-WASHING", "washing", "the washing category"],
    ["ISO3758-BLEACHING", "bleaching", "the bleaching category"],
    ["ISO3758-DRYING", "drying", "the drying category"],
    ["ISO3758-IRONING", "ironing", "the ironing category"],
    ["ISO3758-PROFESSIONAL", "professional", "the professional textile care category"],
  ] as const
).map(([code, kind, which], index) => ({
  id: uuid(index),
  code,
  kind,
  symbolRef: null,
  words: null,
  language: "en",
  source: `ISO 3758:2012, ${which}`,
  sourceKind: "standard" as const,
  confirmed: false,
  ruleId: "R-LAB-002",
  label: "Knitwright draft: the category only. ISO 3758 is not in this repository, so no symbol and no instruction is transcribed.",
}));

/** Owner decision 19's Class A sample, the one AQL row the migration seeds. */
export const SEEDED_AQL_PLAN: AqlPlan = {
  id: uuid(50),
  factoryId: null,
  scope: "class_a_sample",
  inspectEveryPiece: true,
  inspectionLevel: null,
  criticalAql: null,
  majorAql: null,
  minorAql: null,
  source: "Owner decision 19 (plans/platform-v5.md) and decision 0070, section 6",
  confirmed: false,
  ruleId: "R-QC-001",
  label: "Knitwright draft from owner decision 19: a Class A sample is inspected piece by piece, whoever sews it. No run plan is seeded: no factory has agreed a level.",
};

/** A care symbol somebody has finished: a symbol, words and a source. */
export const writtenCareSymbol = (over: Partial<CareSymbol> = {}): CareSymbol => ({
  id: uuid(90),
  code: "ISO3758-WASHING",
  kind: "washing",
  symbolRef: "Figure 1",
  words: "Machine wash at 30 degrees",
  language: "en",
  source: "A licensed copy of ISO 3758:2012, transcribed by the owner",
  sourceKind: "standard",
  confirmed: true,
  ruleId: "R-LAB-002",
  label: "Transcribed from the standard by the owner",
  ...over,
});

/** A market whose whole label has been written. Not a real legal requirement: a shape for the happy path. */
export const writtenLabelRules = (over: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> => ({
  version: 1,
  label: "Written by the owner for this test",
  // A market whose wording is finished has a recorded position on CPSIA too, either way.
  cpsiaRequired: false,
  lines: {
    fibre: { text: "100% Polyester", language: "en", order: "descending_percentage", confirmed: true, source: "The market's own wording" },
    care: { symbolCodes: ["ISO3758-WASHING"], confirmed: true, source: "The market's own wording" },
    origin: { text: "Made in Pakistan", confirmed: true, source: "docs/spec/04-production-package.md, section 07_labels" },
    size: { text: "Size as printed on the size label", confirmed: true, source: "The market's own wording" },
    importer: { text: null, required: false, confirmed: true, source: "The market's own wording" },
  },
  ...over,
});

export const fixtureFabric = (over: Partial<FabricFacts> = {}): FabricFacts => ({
  code: "F-POLY-INT",
  name: "Polyester interlock",
  blend: "100% polyester",
  pfasFree: true,
  oekoTexCert: null,
  ...over,
});

/** A destination whose label can be printed, so a test can take one thing away at a time. */
export const fixtureLabelInput = (over: Partial<DestinationLabelInput> = {}): DestinationLabelInput => ({
  country: "GB",
  countryName: "United Kingdom",
  sellingEnabled: true,
  labelRules: writtenLabelRules(),
  ruleId: "R-LAB-002",
  fabric: fixtureFabric(),
  wearer: "men",
  sizes: ["S", "M", "L"],
  importer: null,
  cpsiaCertificate: null,
  careSymbols: [writtenCareSymbol()],
  ...over,
});

/** A subject with nothing against it, so a test can break one item at a time. */
export const fixtureSubject = (over: Partial<PreExportSubject> = {}): PreExportSubject => ({
  source: "techpack",
  needsInput: [],
  tbcPaths: [],
  poms: [{ letter: "A", description: "Chest width", missingSizes: [], hasTolerance: true, needsInput: false, ruleId: "R-FIT-001" }],
  sizes: ["S", "M", "L"],
  bom: [{ item: "Main fabric", kind: "fabric", gaps: [], ruleId: "R-SUB-001" }],
  colour: {
    fabric: "F-POLY-INT",
    roles: [{ role: "primary", hex: "#0B1F4B", pantoneTcx: "19-4024 TCX", swatchId: "SB-POLY-INT-031" }],
    toleranceMax: 1.5,
    ruleId: "R-SUB-005",
  },
  labels: [destinationLabel(fixtureLabelInput())],
  print: null,
  moderation: { state: "clear", productionClass: "A", humanAllowed: null },
  ...over,
});
