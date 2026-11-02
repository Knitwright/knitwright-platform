import { beforeAll, describe, expect, it } from "vitest";
import { FIXTURE_CONSUMPTION, fixtureRows } from "@/lib/kpp/fixtures/rows";
import { checkPackage } from "@/lib/kpp/gate";
import { buildKppInput } from "@/lib/kpp/input";
import { bomConsumption, CONSUMPTION_SELECT } from "@/lib/kpp/sources/consumption";
import { billOfMaterials } from "@/lib/kpp/input/materials";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261210020000_bom_consumption.sql against the real database (plan v5 section 6 item 2,
 * decision 0101): what the seed really holds, what a member and a visitor may do to it, and — the one that
 * matters — that a production package built on the rows the platform really holds is no longer refused for want
 * of a quantity, while an article that publishes no consumption still is.
 *
 * NOTHING IS INSERTED HERE ON PURPOSE. The service role holds SELECT and nothing else on this table, and
 * `bom_consumption_record` is the only way in; a row a test wrote could not be taken out again and would sit in
 * the shared database for every later run. So every write below is one that must fail, and everything else is a
 * read of what the migration seeded.
 */

let alice: Person;

const ARTICLE = "JSY-SS-01";
const byItem = <T extends { itemId: string }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.itemId.localeCompare(b.itemId));

const allArticleCodes = async (): Promise<readonly string[]> =>
  (must(await adminClient().from("base_articles").select("code").order("code")) as { code: string }[]).map((row) => row.code);

beforeAll(async () => {
  alice = await person("bom-consumption-alice");
  await brandOf(alice, "Alice Consumption FC");
});

describe("the seeded consumption figures", () => {
  it("are the worked article's five lines, each quoting its own article.json and agreed by nobody", async () => {
    const rows = must(await adminClient().from("bom_consumption").select(CONSUMPTION_SELECT).order("item_id")) as Record<string, unknown>[];

    expect(rows.map((row) => row.item_id)).toEqual(["fabric:F-POLY-INT", "fabric:F-POLY-RIB", "label:care", "thread:looper", "thread:needle"]);
    for (const row of rows) {
      expect(row.source_file, String(row.item_id)).toBe(`docs/spec/articles/${ARTICLE}/article.json`);
      expect(row.source_label, String(row.item_id)).toContain("placeholder consumption");
      expect(row.confirmed, String(row.item_id)).toBe(false);
      expect(row.version, String(row.item_id)).toBe(1);
    }
  });

  it("are the figures lib/kpp/fixtures/rows.ts stood in for, so the real package and the test one agree", async () => {
    expect(byItem(await bomConsumption(alice.client, ARTICLE))).toEqual(byItem(FIXTURE_CONSUMPTION));
  });

  it("are held for the one article that publishes a bill of materials, and for no other", async () => {
    for (const code of await allArticleCodes()) {
      const rows = await bomConsumption(adminClient(), code);
      expect(rows.length, code).toBe(code === ARTICLE ? 5 : 0);
    }
  });
});

describe("the production package built on them", () => {
  it("carries a quantity, a unit and a source on every bill-of-materials line", async () => {
    const consumption = await bomConsumption(alice.client, ARTICLE);
    const rows = fixtureRows();

    const bom = billOfMaterials({ ...rows, unsourced: { ...rows.unsourced, consumption } });

    expect(bom.length).toBeGreaterThan(0);
    for (const line of bom) {
      expect(line.qtyPerPiece, line.item).not.toBeNull();
      expect(line.unit, line.item).not.toBeNull();
      expect(line.provenance, line.item).toBe("from_base");
    }
  });

  it("is no longer refused over its bill of materials, where before every line was a refusal", async () => {
    const consumption = await bomConsumption(alice.client, ARTICLE);
    const rows = fixtureRows();

    const withFigures = checkPackage(buildKppInput({ ...rows, unsourced: { ...rows.unsourced, consumption } }));
    const without = checkPackage(buildKppInput({ ...rows, unsourced: { ...rows.unsourced, consumption: [] } }));

    expect(withFigures.filter((issue) => issue.path.startsWith("bom"))).toEqual([]);
    expect(without.filter((issue) => issue.path.startsWith("bom")).length).toBeGreaterThan(0);
  });

  it("is still refused, line by line, for an article that publishes no consumption at all", async () => {
    const rows = fixtureRows();

    const issues = checkPackage(buildKppInput({ ...rows, unsourced: { ...rows.unsourced, consumption: await bomConsumption(alice.client, "TEE-TR-01") } }));

    expect(issues.filter((issue) => issue.path.startsWith("bom")).map((issue) => issue.message).join(" ")).toContain("no quantity");
  });
});

describe("who may touch the table", () => {
  it("shows a signed-in member every row, because the tech pack's bill of materials shows the quantity", async () => {
    const rows = must(await alice.client.from("bom_consumption").select(CONSUMPTION_SELECT));

    expect(rows).toHaveLength(5);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    const { data, error } = await anonClient().from("bom_consumption").select("item_id");

    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("lets the server's own key add, change and remove nothing: the function is the only way in", async () => {
    const admin = adminClient();
    const before = must(await admin.from("bom_consumption").select(CONSUMPTION_SELECT).order("item_id"));

    const added = await admin.from("bom_consumption").insert({ item_id: "label:care", version: 2, qty_per_piece: "9", unit: "pc", source_file: "x", source_label: "x", source_quote: "x" });
    const changed = await admin.from("bom_consumption").update({ qty_per_piece: "9" }).eq("item_id", "label:care");
    const removed = await admin.from("bom_consumption").delete().eq("item_id", "label:care");

    expect(added.error).not.toBeNull();
    expect(changed.error).not.toBeNull();
    expect(removed.error).not.toBeNull();
    expect(must(await admin.from("bom_consumption").select(CONSUMPTION_SELECT).order("item_id"))).toEqual(before);
  });

  it("answers a member who calls the recording function with not found, whatever they ask for", async () => {
    const { error } = await alice.client.rpc("bom_consumption_record", {
      p_actor: alice.userId,
      p_article_code: ARTICLE,
      p_item_id: "label:care",
      p_qty_per_piece: "9",
      p_unit: "pc",
      p_size_dependent: false,
      p_source_file: "made directly",
      p_source_label: "Made directly",
      p_source_quote: "Made directly",
      p_confirmed: true,
      p_rule_id: "R-LAB-002",
    });

    expect(error).not.toBeNull();
    expect(await bomConsumption(adminClient(), ARTICLE)).toHaveLength(5);
  });
});
