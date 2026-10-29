import { registryTypeForBaseArticle } from "../registry-map";
import type { BaseArticle } from "../types";
import type { ArticleUse, ProductionClass } from "../vocabulary";
import { articleTypeOf, DRAFT_LABEL } from "../vocabulary";
import { baseArticleFromJson, type ArticleJsonExtras } from "./article-json";

/**
 * The eight launch articles (docs/spec/articles/ONBOARDING.md). JSY-SS-01 is read from its article.json. The other
 * seven carry only what the build pack says about them, word for word:
 * - code, name, class and uses ("Serves"): ONBOARDING.md, "How many base articles";
 * - sport tags: only the sports named in the article's row of 01-product-direction.md, "Launch catalogue";
 * - fabric codes: the programme code in that same row.
 * The build pack gives none of them a size range, so it is empty, and so are their points of measure, ranges,
 * options and construction. Nothing is filled in to look complete.
 */

/** JSY-SS-01's name says "regular fit"; the file names no gender, so none is set. */
export const JSY_SS_01_EXTRAS: ArticleJsonExtras = { fit: "regular", genders: [] };

type DraftFacts = Readonly<{
  code: string;
  name: string;
  productionClass: ProductionClass;
  uses: readonly ArticleUse[];
  sportTags: readonly string[];
  fabricCodes: readonly string[];
}>;

const DRAFT_FACTS: readonly DraftFacts[] = [
  { code: "SHO-TR-01", name: "Football/training shorts", productionClass: "A", uses: ["teamwear", "studio"], sportTags: ["football", "training"], fabricCodes: ["F-POLY-INT"] },
  { code: "JSY-LS-01", name: "Long-sleeve jersey / goalkeeper", productionClass: "A", uses: ["teamwear", "studio"], sportTags: [], fabricCodes: ["F-POLY-INT"] },
  { code: "CRK-SS-01", name: "Cricket coloured shirt (pique)", productionClass: "A", uses: ["teamwear"], sportTags: ["cricket"], fabricCodes: ["F-POLY-PQ"] },
  { code: "TEE-TR-01", name: "Training tee, stock-colour fabric", productionClass: "B", uses: ["teamwear", "studio"], sportTags: ["training"], fabricCodes: ["F-STK-TEE"] },
  { code: "HOD-ST-01", name: "Hoodie, stock-colour fleece", productionClass: "B", uses: ["teamwear", "studio"], sportTags: [], fabricCodes: ["F-STK-FLC"] },
  { code: "CMP-LS-01", name: "Compression top / rash guard", productionClass: "A", uses: ["studio"], sportTags: [], fabricCodes: ["F-POLY-EL"] },
  { code: "FSH-MM-01", name: "Fight shorts (MMA/BJJ)", productionClass: "A", uses: ["studio"], sportTags: ["mma", "bjj"], fabricCodes: ["F-POLY-4W"] },
];

const draftArticle = (facts: DraftFacts): BaseArticle => ({
  code: facts.code,
  name: facts.name,
  articleType: articleTypeOf(facts.code),
  productionClass: facts.productionClass,
  status: "draft",
  sportTags: [...facts.sportTags],
  uses: [...facts.uses],
  fit: null,
  genders: [],
  sizeRange: [],
  sampleSize: null,
  registryTypeId: registryTypeForBaseArticle(facts.code),
  dataLabel: DRAFT_LABEL,
  hsCode: null,
  origin: null,
  sourceVersion: null,
  sourceNote: null,
  glbModelKey: null,
  uvPanelMap: null,
  parametricScriptId: null,
  parametricScriptVersion: null,
  seamAllowances: null,
  thread: null,
  poms: [],
  parameters: [],
  options: [],
  construction: [],
  fabrics: facts.fabricCodes.map((code) => ({
    code,
    role: null,
    description: null,
    gsm: null,
    widthCm: null,
    pressShrinkLengthPct: null,
    pressShrinkWidthPct: null,
    sourceNote: null,
  })),
});

/** The seven articles still in draft, in onboarding order. */
export const DRAFT_ARTICLES: readonly BaseArticle[] = DRAFT_FACTS.map(draftArticle);

/** The whole launch catalogue, JSY-SS-01 first, from the contents of its article.json. */
export const launchCatalogue = (jsySs01Json: unknown): readonly BaseArticle[] => [
  baseArticleFromJson(jsySs01Json, JSY_SS_01_EXTRAS),
  ...DRAFT_ARTICLES,
];
