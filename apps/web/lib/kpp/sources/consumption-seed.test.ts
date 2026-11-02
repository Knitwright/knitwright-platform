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

describe("what the migration grants and guards", () => {
  /**
   * The database tests read the real database and never write to it (the service role holds no DELETE on a
   * seeded table, so a row a test inserted would sit in the shared database for ever). So what the migration
   * asks of the database is read here, out of the file itself, and `tests/integration/bom-consumption.test.ts`
   * then proves the database really behaves that way.
   */
  const sql = (): string => readFileSync(MIGRATION, "utf8");

  it("gives a member and the server's key SELECT, and nobody INSERT, UPDATE or DELETE", () => {
    expect(sql()).toContain("revoke all on public.bom_consumption from public, anon, authenticated, service_role;");
    expect(sql()).toContain("grant select on public.bom_consumption to authenticated, service_role;");
    expect(sql()).not.toMatch(/grant [^;]*\b(insert|update|delete)\b[^;]*on public\.bom_consumption/i);
  });

  it("turns row level security on, lets a member read, and writes no policy that would let one write", () => {
    expect(sql()).toContain("alter table public.bom_consumption enable row level security;");
    expect(sql()).toContain('create policy "members read bom consumption"');
    expect(sql()).not.toMatch(/for (insert|update|delete)\s+to authenticated/i);
  });

  it("guards the table against every change and removal, and against a truncate", () => {
    expect(sql()).toContain("create trigger bom_consumption_is_versioned");
    expect(sql()).toContain("create trigger bom_consumption_is_not_truncated");
    expect(sql()).toContain("A consumption figure can never be changed or removed; record a new version instead.");
  });

  it("lets a figure go only with the base article it describes, which is the only delete it allows", () => {
    expect(sql()).toContain("if not exists (select 1 from public.base_articles a where a.id = old.article_id) then");
    expect(sql()).toContain("article_id uuid not null references public.base_articles (id) on delete cascade");
  });

  it("lets only the server's key call the recording function, which refuses anyone who is not a platform admin", () => {
    expect(sql()).toMatch(/revoke all on function public\.bom_consumption_record\([^)]*\)\s*\n?\s*from public, anon, authenticated;/);
    expect(sql()).toMatch(/grant execute on function public\.bom_consumption_record\([^)]*\)\s*\n?\s*to service_role;/);
    expect(sql()).toContain("not exists (select 1 from public.platform_admins a where a.user_id = p_actor)");
  });

  it("refuses a figure that is not a positive number, a unit it does not know, and an item the package cannot carry", () => {
    expect(sql()).toContain("qty_per_piece ~ '^[0-9]{1,6}(\\.[0-9]{1,3})?$' and qty_per_piece !~ '^0+(\\.0+)?$'");
    expect(sql()).toContain("unit text not null check (unit in ('m', 'm2', 'pc', 'g'))");
    expect(sql()).toContain("item_id text not null check (item_id ~ '^(fabric:[A-Z0-9][A-Z0-9-]{0,30}|thread:needle|thread:looper|label:care)$')");
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
