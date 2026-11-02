import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { BOM_ITEM_IDS } from "../input/materials";
import { bomConsumption, consumptionNote, newestPerItem, toConsumption, type ConsumptionDbRow } from "./consumption";

/**
 * Reading what one garment consumes. The figures a package is built on are rows, so this is where the package
 * stops being refused for want of a quantity — and where it goes on being refused for an article nothing is
 * recorded for, which is the normal answer for seven of the eight base articles.
 */

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_FILE = "docs/spec/articles/JSY-SS-01/article.json";
const SOURCE_LABEL = "Knitwright draft v0.1, placeholder consumption, factory confirms from the marker";

type Answer = { data: unknown; error: { message: string } | null };

const dbRow = (patch: Partial<ConsumptionDbRow> = {}): ConsumptionDbRow => ({
  item_id: BOM_ITEM_IDS.fabric("F-POLY-INT"),
  version: 1,
  qty_per_piece: "0.80",
  unit: "m",
  size_dependent: true,
  source_file: SOURCE_FILE,
  source_label: SOURCE_LABEL,
  source_quote: "0.80 m at 180 cm width (size M, incl. bleed and press shrink)",
  confirmed: false,
  rule_id: "R-SUB-001",
  ...patch,
});

/** A client that answers each table with a fixed result and records the filters asked for. */
function fakeClient(tables: Record<string, Answer>) {
  const asked: { table: string; filters: [string, unknown][] }[] = [];
  const client = {
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      asked.push({ table, filters });
      const answer = tables[table] ?? { data: null, error: null };
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => (filters.push([column, value]), query),
        order: () => query,
        limit: async () => answer,
        maybeSingle: async () => answer,
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, asked };
}

const withArticle = (rows: unknown, error: { message: string } | null = null) =>
  fakeClient({ base_articles: { data: { id: ARTICLE_ID }, error: null }, bom_consumption: { data: rows, error } });

describe("one row as the package reads it", () => {
  it("names the file the figure came from and then what that file says it is worth", () => {
    expect(toConsumption(dbRow())).toEqual({
      itemId: "fabric:F-POLY-INT",
      qtyPerPiece: "0.80",
      unit: "m",
      sizeDependent: true,
      label: `${SOURCE_FILE}: ${SOURCE_LABEL}`,
      ruleId: "R-SUB-001",
    });
  });

  it("keeps the figure's own trailing zero, because the package quotes it rather than re-rounding it", () => {
    expect(toConsumption(dbRow({ qty_per_piece: "0.80" })).qtyPerPiece).toBe("0.80");
    expect(toConsumption(dbRow({ qty_per_piece: "1" })).qtyPerPiece).toBe("1");
  });
});

describe("the newest version of each line", () => {
  it("builds the package on the newest figure and leaves the one it replaced findable", () => {
    const old = dbRow({ version: 1, qty_per_piece: "0.80", source_label: SOURCE_LABEL });
    const agreed = dbRow({ version: 2, qty_per_piece: "0.86", source_label: "Sialkot partner marker, 2027-01", confirmed: true });

    expect(newestPerItem([old, agreed]).map(toConsumption)).toEqual([toConsumption(agreed)]);
    expect(newestPerItem([agreed, old]).map(toConsumption)).toEqual([toConsumption(agreed)]);
  });

  it("keeps one line per item and does not let one line's versions hide another line", () => {
    const rows = [dbRow({ version: 2 }), dbRow({ item_id: BOM_ITEM_IDS.needleThread, version: 1 }), dbRow({ version: 1 })];

    expect(newestPerItem(rows).map((row) => [row.item_id, row.version])).toEqual([
      ["fabric:F-POLY-INT", 2],
      ["thread:needle", 1],
    ]);
  });

  it("is empty for no rows at all", () => {
    expect(newestPerItem([])).toEqual([]);
  });
});

describe("reading one article's figures", () => {
  it("reads the article's id first and then its own rows, as the catalogue's reads do", async () => {
    const { client, asked } = withArticle([dbRow(), dbRow({ item_id: BOM_ITEM_IDS.careLabel, qty_per_piece: "1", unit: "pc", size_dependent: false, source_quote: "1 pc", rule_id: "R-LAB-002" })]);

    const rows = await bomConsumption(client, "JSY-SS-01");

    expect(rows.map((row) => row.itemId)).toEqual(["fabric:F-POLY-INT", "label:care"]);
    expect(asked[0]?.table).toBe("base_articles");
    expect(asked[1]).toEqual({ table: "bom_consumption", filters: [["article_id", ARTICLE_ID]] });
  });

  it("is empty for an article the catalogue does not hold", async () => {
    expect(await bomConsumption(fakeClient({}).client, "XXX-XX-00")).toEqual([]);
  });

  it("is empty for an article nothing is recorded for, so the gate goes on refusing its package", async () => {
    const { client } = withArticle([]);

    expect(await bomConsumption(client, "TEE-TR-01")).toEqual([]);
  });

  it("reports a failed read, a row it cannot read, and an article id it cannot read", async () => {
    await expect(bomConsumption(withArticle(null, { message: "boom" }).client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
    await expect(bomConsumption(withArticle([{ item_id: "fabric:F-POLY-INT" }]).client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
    const broken = fakeClient({ base_articles: { data: { id: "not-a-uuid" }, error: null } });
    await expect(bomConsumption(broken.client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
    const failed = fakeClient({ base_articles: { data: null, error: { message: "boom" } } });
    await expect(bomConsumption(failed.client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
  });

  it("refuses a rule id that is not a rule id, so a figure cannot arrive without one", async () => {
    await expect(bomConsumption(withArticle([dbRow({ rule_id: "gap" })]).client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
  });
});

describe("the sentence the package carries about its quantities", () => {
  it("says plainly that nothing is on file, and why that is not estimated here", () => {
    const note = consumptionNote([]);

    expect(note).toContain("No consumption figure is on file");
    expect(note).toContain("factory's own marker");
    expect(note).not.toMatch(/\b(confirmed|verified|checked|approved)\b/i);
  });

  it("counts the figures, names where they came from, and says no factory has agreed them", () => {
    const note = consumptionNote([toConsumption(dbRow()), toConsumption(dbRow({ item_id: BOM_ITEM_IDS.needleThread }))]);

    expect(note).toContain("quotes 2 consumption figures");
    expect(note).toContain(SOURCE_FILE);
    expect(note).toContain("No factory has agreed any of them");
  });

  it("counts one figure as one", () => {
    expect(consumptionNote([toConsumption(dbRow())])).toContain("quotes 1 consumption figure, from");
  });
});
