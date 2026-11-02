import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "@/lib/catalogue/fixtures/source";
import { FIXTURE_CONSUMPTION } from "../fixtures/rows";
import { BOM_ITEM_IDS } from "../input/materials";
import { consumptionDbRow, toConsumption, type ConsumptionDbRow } from "./consumption";

/**
 * **A consumption is a measurement, and no measurement may be invented.** This test is the whole guard on that:
 * it reads every base article's own `article.json` and the migration that seeds `bom_consumption`, and it fails
 * when the two disagree in either direction — a figure seeded that the article does not publish, or an article
 * that publishes figures and has none seeded.
 *
 * Seven of the eight base articles publish no bill of materials at all (decision 0090: seven have empty
 * point-of-measure tables and no published measurement), so seven have no rows, and the F-G2 gate goes on
 * refusing their packages and naming the line it has no quantity for. That is the intended answer, and the test
 * below says so rather than leaving it to be noticed.
 */

const MIGRATION = join(REPO_ROOT, "supabase", "migrations", "20261210020000_bom_consumption.sql");
const ARTICLES = join(REPO_ROOT, "docs", "spec", "articles");

type ArticleJson = Readonly<{
  code: string;
  fabrics?: Record<string, { code?: string }>;
  thread?: unknown;
  bom?: readonly Record<string, unknown>[];
}>;

const articleCodes = (): readonly string[] =>
  readdirSync(ARTICLES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

const readArticle = (code: string): ArticleJson => JSON.parse(readFileSync(join(ARTICLES, code, "article.json"), "utf8")) as ArticleJson;

/** Every `consumption` field the article publishes, in its own words. */
const publishedFigures = (article: ArticleJson): readonly string[] =>
  (article.bom ?? []).map((line) => String(line.consumption ?? "")).filter((figure) => figure.trim() !== "");

/**
 * The article's own BOM line one seeded row is about, found the way the line was chosen in the first place: a
 * fabric by its code, each thread and the care label by the article's own description of it. Finding the line
 * rather than searching the file for the words is what makes the citation a citation: "1 pc" appears against
 * three different lines, and only one of them is the care label.
 */
function publishedLine(article: ArticleJson, itemId: string): Record<string, unknown> | undefined {
  const bom = article.bom ?? [];
  const described = (description: string) => bom.find((line) => String(line.description) === description);
  if (itemId.startsWith("fabric:")) {
    const code = itemId.slice("fabric:".length);
    return bom.find((line) => String(line.category) === "Fabric" && String(line.material).includes(code));
  }
  if (itemId === BOM_ITEM_IDS.needleThread) return described("Needle thread");
  if (itemId === BOM_ITEM_IDS.looperThread) return described("Looper thread");
  return described("Care and fibre label");
}

/** The BOM item ids `lib/kpp/input/materials.ts` can build a line for, for this article. */
function carriableItemIds(article: ArticleJson): readonly string[] {
  const fabrics = Object.values(article.fabrics ?? {}).map((fabric) => BOM_ITEM_IDS.fabric(String(fabric.code)));
  const threads = article.thread === null || article.thread === undefined ? [] : [BOM_ITEM_IDS.needleThread, BOM_ITEM_IDS.looperThread];
  return [...fabrics, ...threads, BOM_ITEM_IDS.careLabel];
}

/**
 * The rows the migration seeds, read back out of its own `insert`. No seeded value holds an apostrophe, so one
 * pattern reads the whole tuple; a value that ever does will fail this read rather than pass unnoticed.
 */
const ROW = new RegExp(
  [
    String.raw`\(\(select id from public\.base_articles where code = '([^']+)'\), `,
    String.raw`'([^']+)', (\d+), '([^']+)', '([^']+)', (true|false),\s*`,
    String.raw`'([^']+)',\s*'([^']+)',\s*'([^']+)', (true|false), '([^']+)'\)`,
  ].join(""),
  "g",
);

type Seeded = Readonly<{ articleCode: string; row: ConsumptionDbRow }>;

function seededRows(): readonly Seeded[] {
  const sql = readFileSync(MIGRATION, "utf8");
  return [...sql.matchAll(ROW)].map((found) => ({
    articleCode: found[1] ?? "",
    row: consumptionDbRow.parse({
      item_id: found[2],
      version: Number(found[3]),
      qty_per_piece: found[4],
      unit: found[5],
      size_dependent: found[6] === "true",
      source_file: found[7],
      source_label: found[8],
      source_quote: found[9],
      confirmed: found[10] === "true",
      rule_id: found[11],
    }),
  }));
}

const forArticle = (code: string): readonly Seeded[] => seededRows().filter((seeded) => seeded.articleCode === code);

describe("the seeded consumption figures against the articles that publish them", () => {
  it("seeds nothing at all for an article that publishes no bill of materials", () => {
    for (const code of articleCodes()) {
      const published = publishedFigures(readArticle(code));
      if (published.length > 0) continue;
      expect(forArticle(code), code).toEqual([]);
    }
  });

  it("seeds a figure for every article that publishes one", () => {
    for (const code of articleCodes()) {
      if (publishedFigures(readArticle(code)).length === 0) continue;
      expect(forArticle(code).length, code).toBeGreaterThan(0);
    }
  });

  it("quotes every seeded figure from its own line of its own article's file, word for word", () => {
    for (const { articleCode, row } of seededRows()) {
      const line = publishedLine(readArticle(articleCode), row.item_id);

      expect(line, `${articleCode} ${row.item_id}`).toBeDefined();
      expect(String(line?.consumption), `${articleCode} ${row.item_id}`).toBe(row.source_quote);
      expect(row.source_file).toBe(`docs/spec/articles/${articleCode}/article.json`);
    }
  });

  it("takes the quantity and the unit out of the words it quotes, so neither can drift from them", () => {
    for (const { articleCode, row } of seededRows()) {
      expect(row.source_quote, `${articleCode} ${row.item_id}`).toContain(`${row.qty_per_piece} ${row.unit}`);
    }
  });

  it("seeds only lines the package's bill of materials can carry, one version each", () => {
    for (const { articleCode, row } of seededRows()) {
      expect(carriableItemIds(readArticle(articleCode)), `${articleCode} ${row.item_id}`).toContain(row.item_id);
      expect(row.version).toBe(1);
    }
  });

  it("confirms nothing and labels every figure a draft, because no factory has agreed one", () => {
    for (const { row } of seededRows()) {
      expect(row.confirmed).toBe(false);
      expect(row.source_label).toContain("Knitwright draft");
      expect(row.source_label).toContain("placeholder consumption");
    }
  });
});

describe("the seeded figures against the fixture that stood in for them", () => {
  /**
   * `lib/kpp/fixtures/rows.ts` quoted the worked article's figures so a test could build a whole package while no
   * table held them. Now one does, and the two must be the same figures: otherwise the package a test builds and
   * the package the route serves would differ in the numbers a factory cuts to.
   */
  it("gives the package exactly what the fixture promised, for every line and its provenance", () => {
    const byItem = (rows: readonly { itemId: string }[]) => [...rows].sort((a, b) => a.itemId.localeCompare(b.itemId));

    expect(byItem(forArticle("JSY-SS-01").map((seeded) => toConsumption(seeded.row)))).toEqual(byItem(FIXTURE_CONSUMPTION));
  });
});

describe("what the article publishes and the package has no line for", () => {
  /**
   * The article publishes nine BOM lines; `materials.ts` builds fabric, thread and care-label lines and no
   * others. The four that are left over are named here so the shortfall is a failing test the day a line is
   * added, rather than a figure quietly missing from a package.
   */
  it("names each published figure the package's bill of materials cannot carry", () => {
    const article = readArticle("JSY-SS-01");
    const carried = forArticle("JSY-SS-01").map((seeded) => publishedLine(article, seeded.row.item_id));

    const uncarried = (article.bom ?? []).filter((line) => !carried.includes(line));

    expect(uncarried.map((line) => `${String(line.description)}: ${String(line.consumption)}`)).toEqual([
      "Back neck tape: 0.20 m",
      "Neck label, heat transfer: 1 pc",
      "Polybag: 1 pc",
      "Sublimation transfer paper and ink: about 1.6 m2 paper (size M)",
    ]);
  });
});
