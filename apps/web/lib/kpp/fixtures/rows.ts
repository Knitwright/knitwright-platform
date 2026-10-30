import { catalogue } from "@/lib/catalogue/fixtures/source";
import type { BaseArticle } from "@/lib/catalogue";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { toDesignObjectV2, type DesignObjectV2 } from "@/lib/design-object";
import { allRows } from "@/lib/factory/fixtures/rows";
import { toCapability, toColour, toCountryRule, toFabric, toFactory } from "@/lib/factory/rows";
import type { FabricColour } from "@/lib/factory/schemas";
import { DEFAULT_SETTINGS } from "@/lib/guardrails";
import { BOM_ITEM_IDS } from "../input/materials";
import type { ConsumptionRow, KppRows, KppUnsourced, LabelWordingRow } from "../input/model";

/**
 * TEST FIXTURE ONLY: one `KppRows` over the rows the platform really seeds — X1's base article catalogue
 * (`lib/catalogue/fixtures/source.ts`, built from `docs/spec/articles/JSY-SS-01/article.json`), X4's design object
 * and X6's factory, fabric, colour and country rows (`lib/factory/fixtures/rows.ts`).
 *
 * Every value is a Knitwright draft for factory review, not an agreed number. The `KppUnsourced` values are the
 * ones no table holds: they are quoted here from the worked article's own JSON, which labels them placeholders, so
 * a test can build a whole package; `rows.test.ts` checks each one still matches that file.
 */

const ARTICLE_CODE = "JSY-SS-01";

export const fixtureArticle = (): BaseArticle => {
  const article = catalogue().find((row) => row.code === ARTICLE_CODE);
  if (article === undefined) throw new Error(`The catalogue fixture has no ${ARTICLE_CODE}.`);
  return article;
};

export function fixtureObject(article: BaseArticle = fixtureArticle()): DesignObjectV2 {
  const result = toDesignObjectV2(jersey(), {
    article: { baseArticleCode: article.code, productionClass: article.productionClass, parameters: { body_length_offset: 10 } },
    fabricCode: "F-POLY-INT",
  });
  if (!result.ok) throw new Error(result.reason);
  return result.object;
}

/**
 * A programme colour row per colour of the design, so the fabric's swatch reference and its Pantone code reach the
 * package. The programme really holds colours only for the two stock fabrics, so these stand in for the rows a
 * colour house would give us for a sublimation fabric; the Pantone is the illustrative one of docs/spec/04.
 */
export const fixtureFabricColours = (object: DesignObjectV2): readonly FabricColour[] =>
  object.colourway.colours.map((colour, index) => ({
    id: `88888888-8888-4888-8888-${String(index).padStart(12, "0")}`,
    fabricCode: "F-POLY-INT",
    name: colour.role,
    hex: colour.hex.toUpperCase(),
    lab: null,
    pantone: colour.pantone ?? "19-4024 TCX",
    label: "Test row, not a measured swatch",
  }));

const SOURCE = "docs/spec/articles/JSY-SS-01/article.json: Knitwright draft v0.1, placeholder consumption, factory confirms from the marker";

const consumption = (itemId: string, qtyPerPiece: string, unit: string, sizeDependent: boolean, ruleId = "R-GAP-000"): ConsumptionRow => ({
  itemId,
  qtyPerPiece,
  unit,
  sizeDependent,
  label: SOURCE,
  ruleId,
});

/** The worked article's own consumption figures, quoted. No table holds them (decision 0070 revision 2). */
export const FIXTURE_CONSUMPTION: readonly ConsumptionRow[] = [
  consumption(BOM_ITEM_IDS.fabric("F-POLY-INT"), "0.80", "m", true, "R-SUB-001"),
  consumption(BOM_ITEM_IDS.fabric("F-POLY-RIB"), "0.05", "m", false),
  consumption(BOM_ITEM_IDS.needleThread, "60", "m", false, "R-CON-009"),
  consumption(BOM_ITEM_IDS.looperThread, "110", "m", false, "R-CON-009"),
  consumption(BOM_ITEM_IDS.careLabel, "1", "pc", false, "R-LAB-002"),
];

/** The worked article's own care-label wording, quoted. `country_rules.label_rules` is still `{}`. */
export const FIXTURE_LABEL_WORDING: readonly LabelWordingRow[] = [
  {
    country: "GB",
    fibre: "100% Polyester",
    care: ["Wash 30 C", "Do not bleach", "Do not tumble dry", "Do not iron print", "Do not dry clean"],
    origin: "Made in Pakistan",
    size: "See size label",
    importer: "Brand or importer name and address",
    importerRequired: true,
  },
  {
    country: "AU",
    fibre: "100% Polyester",
    care: ["Care instructions in words (Australian care labelling standard)"],
    origin: "Made in Pakistan",
    size: "See size label",
    importer: null,
    importerRequired: false,
  },
];

/** The worked article's own QC plan, quoted. No table holds it. */
export const FIXTURE_UNSOURCED: KppUnsourced = {
  consumption: FIXTURE_CONSUMPTION,
  labelWording: FIXTURE_LABEL_WORDING,
  quality: {
    aqlPlan: "AQL 0 critical / 2.5 major / 4.0 minor, level II",
    measure: ["A", "B", "C", "D", "E", "F", "G"],
    visual: ["Print alignment across side and shoulder seams within 3 mm"],
    photos: ["Front", "Back", "Care label", "Side seam close-up", "Print edge close-up"],
  },
  packing: ["Fold flat and bag each order separately."],
};

/** The real seeded rows, as one `KppRows`. `patch` is for the tests that take one row away. */
export function fixtureRows(patch: Partial<KppRows> = {}): KppRows {
  const article = fixtureArticle();
  const object = fixtureObject(article);
  const factory = toFactory(allRows.factories[0]);
  const capabilities = allRows.factory_capabilities.map(toCapability).filter((row) => row.articleCode === article.code);
  return {
    kind: "sample",
    design: {
      code: "ACME_Home_Kit",
      name: "Home kit 2027",
      version: 3,
      hash: "a".repeat(64),
      createdAtIso: "2026-10-25T09:30:00.000Z",
      brand: "Acme FC",
      season: "SS27",
    },
    object,
    article,
    factory,
    capability: capabilities[0] ?? null,
    fabrics: allRows.programme_fabrics.map(toFabric),
    fabricColours: fixtureFabricColours(object),
    markets: allRows.country_rules.map(toCountryRule).filter((rule) => rule.sellingEnabled),
    print: DEFAULT_SETTINGS,
    moderation: "clear",
    dueDate: "2026-11-20",
    madeByKnitwright: true,
    orders: [],
    personalisation: [],
    unsourced: FIXTURE_UNSOURCED,
    ...patch,
  };
}

/** The programme's own colour rows, for a test that wants a colour the programme does not hold. */
export const programmeColours = (): readonly FabricColour[] => allRows.programme_fabric_colours.map(toColour);
