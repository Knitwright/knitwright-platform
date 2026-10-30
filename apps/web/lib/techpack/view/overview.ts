import type { BaseArticle } from "@/lib/catalogue";
import { GAP_RULE } from "@/lib/kpp/model";
import { fromBase, fromDesign, needsInput, type ViewCell } from "./fields";
import { section, tab, table, type TabView } from "./rows";

/**
 * The **Overview** and **Body** tabs (spec F-S6).
 *
 * Overview: the header fields a founder types, then the article's own facts. Nothing is filled in
 * from somewhere else: the brand, the collection and the season are the brand's to give, and the
 * editor's slot contract does not carry them, so they read "Needs your input" rather than guessing
 * from the design's name.
 *
 * Body: the body size chart the garment is graded from. The base article catalogue (X1) holds the
 * **garment's** points of measure, not the **body** chart behind them — `base_articles` has a size
 * range and a sample size and no chest, waist, hip or height per size, and
 * `docs/spec/articles/JSY-SS-01/article.json` has none either. So the tab says the chart is not on
 * file and names the rule that would explain it, and the Review tab counts it. Inventing a body
 * chart from the garment's chest width is exactly the invented measurement the rules forbid.
 */

const NO_ARTICLE = "This design is not on a base article the catalogue covers, so the base's own fields are empty.";
const NO_CHART = "No body size chart is on file for this base article yet. The size standard and its chest, waist, hip and height per size come from the factory.";

/** The rule the size range and the sample size belong to in `JSY-SS-01/rulebook.md` (grading practice). */
const GRADE_RULE = "R-FIT-001";

export type OverviewHeader = Readonly<{
  /** The design's own name, as the person typed it when the design was created. Null while the slot is not given one. */
  styleName: string | null;
  /** The line the form reads as, from `autoDesignName` (Y2). Null for a design with no base article. */
  formName: string | null;
  brand: string | null;
  collection: string | null;
  season: string | null;
  /** The factory the design validates against, by name. Null while none is chosen. */
  factory: string | null;
}>;

/** The style code spec F-S6 auto-generates, `<brand>_<name>`, or null while either part is missing. */
export function styleCode(header: OverviewHeader): string | null {
  const brand = header.brand?.trim() ?? "";
  const name = header.styleName?.trim() ?? "";
  if (brand === "" || name === "") return null;
  return `${slug(brand)}_${slug(name)}`;
}

const slug = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

const headerFields = (header: OverviewHeader): readonly ViewCell[] => [
  cellOrAsk("style-name", "Style name", header.styleName, GAP_RULE),
  cellOrAsk("style-code", "Style code", styleCode(header), GAP_RULE),
  cellOrAsk("brand", "Brand", header.brand, GAP_RULE),
  cellOrAsk("collection", "Collection", header.collection, GAP_RULE),
  cellOrAsk("season", "Season", header.season, GAP_RULE),
  cellOrAsk("form", "The form this design is on", header.formName, GAP_RULE),
  cellOrAsk("factory", "Factory", header.factory, GAP_RULE),
];

/** A header field the person fills in: theirs when it has a value, a question when it does not. */
const cellOrAsk = (id: string, label: string, text: string | null, ruleId: string): ViewCell =>
  text === null || text.trim() === "" ? needsInput({ id, label, ruleId }) : fromDesign({ id, label, text, ruleId });

const articleFields = (article: BaseArticle | null): readonly ViewCell[] => {
  if (!article) {
    return [
      needsInput({ id: "base-article", label: "Base article code", ruleId: GAP_RULE }),
      needsInput({ id: "production-class", label: "Production class", ruleId: GAP_RULE }),
      needsInput({ id: "sample-size", label: "Sample size", ruleId: GRADE_RULE }),
      needsInput({ id: "size-range", label: "Size range", ruleId: GRADE_RULE }),
      needsInput({ id: "fabric", label: "Fabric", ruleId: GAP_RULE }),
    ];
  }
  return [
    fromBase({ id: "base-article", label: "Base article code", text: article.code, ruleId: GAP_RULE }),
    fromBase({ id: "article-name", label: "Base article", text: article.name, ruleId: GAP_RULE }),
    fromBase({ id: "production-class", label: "Production class", text: article.productionClass, ruleId: GAP_RULE }),
    fromBase({ id: "sample-size", label: "Sample size", text: article.sampleSize, ruleId: GRADE_RULE }),
    fromBase({ id: "size-range", label: "Size range", text: article.sizeRange.join(", "), ruleId: GRADE_RULE }),
    fromBase({ id: "fabric", label: "Fabric", text: article.fabrics.map((entry) => entry.code).join(", "), ruleId: GAP_RULE }),
    fromBase({ id: "origin", label: "Country of origin", text: article.origin, ruleId: "R-LAB-002" }),
    fromBase({ id: "hs-code", label: "HS code", text: article.hsCode, ruleId: GAP_RULE }),
  ];
};

/** The key construction features the overview page of the worked tech pack leads with, from the base's own table. */
const featureRows = (article: BaseArticle | null) =>
  (article?.construction ?? []).slice(0, 4).map((step) => ({
    id: `feature-${step.step}`,
    label: step.seam,
    cells: [
      fromBase({ id: `feature-${step.step}-seam`, label: "Seam", text: step.seam, ruleId: step.ruleId }),
      fromBase({ id: `feature-${step.step}-operation`, label: "Operation", text: step.operation, ruleId: step.ruleId }),
    ],
  }));

export function buildOverview(header: OverviewHeader, article: BaseArticle | null): TabView {
  return tab("overview", [
    section({ id: "header", title: "Style details", fields: headerFields(header) }),
    section({
      id: "base",
      title: "From the base article",
      note: article ? null : NO_ARTICLE,
      fields: articleFields(article),
      tables: [
        table({
          id: "features",
          title: "Key construction features",
          columns: ["Seam", "Operation"],
          rows: featureRows(article),
        }),
      ],
    }),
  ]);
}

/** The Body tab: the size run the garment grades over, and the body chart that is not on file. */
export function buildBody(article: BaseArticle | null): TabView {
  return tab("body", [
    section({
      id: "standard",
      title: "Size standard",
      note: NO_CHART,
      fields: [
        needsInput({ id: "size-standard", label: "Size standard", ruleId: GRADE_RULE }),
        article
          ? fromBase({ id: "body-sizes", label: "Sizes graded", text: article.sizeRange.join(", "), ruleId: GRADE_RULE })
          : needsInput({ id: "body-sizes", label: "Sizes graded", ruleId: GRADE_RULE }),
        article
          ? fromBase({ id: "body-sample", label: "Sample size", text: article.sampleSize, ruleId: GRADE_RULE })
          : needsInput({ id: "body-sample", label: "Sample size", ruleId: GRADE_RULE }),
      ],
      tables: [
        // One row per body point, each with one cell for the whole size run. A cell per size would
        // put four rows times seven sizes of the same one question on the Review tab, when the
        // question is a single one: which size standard this article is graded from.
        table({
          id: "body-chart",
          title: "Body measurements per size",
          rowHeader: "Measurement",
          columns: ["Per size"],
          rows: BODY_POINTS.map((point) => ({
            id: `body-${point.id}`,
            label: point.label,
            cells: [needsInput({ id: `body-${point.id}`, label: `${point.label} per size`, ruleId: GRADE_RULE })],
          })),
          note: NO_CHART,
        }),
      ],
    }),
  ]);
}

/** The four rows spec F-S6 names for the body chart: chest, waist, hip and height. */
const BODY_POINTS: readonly Readonly<{ id: string; label: string }>[] = [
  { id: "chest", label: "Chest" },
  { id: "waist", label: "Waist" },
  { id: "hip", label: "Hip" },
  { id: "height", label: "Height" },
];
