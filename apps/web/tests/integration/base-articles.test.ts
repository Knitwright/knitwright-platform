import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getBaseArticle, listBaseArticles, optionsFor, parameterRange } from "@/lib/catalogue";
import { launchCatalogue } from "@/lib/catalogue/seed/launch";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261101010000: the base article catalogue (plan v5 X1, decision 0066). Members read it; nobody writes it
 * from a browser, a platform admin included; the server writes through the service client. The seed reads back
 * exactly as docs/spec/articles/JSY-SS-01/article.json gives it.
 *
 * Written without local Supabase (no Docker in the agent sandbox), so this file first runs in CI. The migration, its
 * grants, its policies and its seed were checked against a throwaway PostgreSQL first; what only CI can exercise is
 * PostgREST, the browser clients and the helpers in support.ts.
 */

const ARTICLE_JSON = join(__dirname, "..", "..", "..", "..", "docs", "spec", "articles", "JSY-SS-01", "article.json");
const expected = launchCatalogue(JSON.parse(readFileSync(ARTICLE_JSON, "utf8")));

const TABLES = ["base_articles", "article_poms", "parameter_defs", "option_defs", "article_construction", "article_fabrics"] as const;

let member: Person;
let admin: Person;
let loner: Person;

beforeAll(async () => {
  [member, admin, loner] = await Promise.all([person("cat-member"), person("cat-admin"), person("cat-loner")]);
  await brandOf(member, "Catalogue Club");
  await brandOf(admin, "Catalogue Admin Club");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
});

describe("the seeded catalogue", () => {
  it("reads JSY-SS-01 back exactly as article.json gives it: every point of measure, range, option and seam", async () => {
    expect(await getBaseArticle(member.client, "JSY-SS-01")).toEqual(expected[0]);
  });

  it("holds the seven other launch articles as drafts with fabric codes only", async () => {
    for (const draft of expected.slice(1)) expect(await getBaseArticle(member.client, draft.code)).toEqual(draft);
  });

  it("lists and filters the eight launch articles", async () => {
    const all = await listBaseArticles(member.client);
    expect(all.map((a) => a.code).sort()).toEqual(expected.map((a) => a.code).sort());
    expect((await listBaseArticles(member.client, { fabric: "F-POLY-INT" })).map((a) => a.code)).toEqual(["JSY-LS-01", "JSY-SS-01", "SHO-TR-01"]);
    expect((await listBaseArticles(member.client, { productionClass: "B" })).map((a) => a.code)).toEqual(["HOD-ST-01", "TEE-TR-01"]);
  });

  it("reads one range and one option group", async () => {
    expect(await parameterRange(member.client, "JSY-SS-01", "back_drop_tail")).toMatchObject({ min: 0, max: 40, step: 10, approvedBySampleId: null });
    expect((await optionsFor(member.client, "JSY-SS-01", "collar")).map((o) => o.code)).toEqual(["C01", "C02", "C03"]);
  });
});

describe("who reads and writes the catalogue", () => {
  it.each(TABLES)("%s is refused to a visitor and shows nothing to a person with no brand", async (table) => {
    expect((await anonClient().from(table).select("*").limit(1)).error).not.toBeNull();
    expect(must(await loner.client.from(table).select("*").limit(1))).toEqual([]);
  });

  it.each([
    ["a member", () => member],
    ["a platform admin", () => admin],
  ])("refuses a browser write from %s", async (_who, who) => {
    const client = who().client;
    expect((await client.from("base_articles").insert({ code: "ZZZ-ZZ-01", name: "Mine", article_type: "ZZZ", production_class: "A", data_label: "Mine" })).error).not.toBeNull();
    await client.from("base_articles").update({ name: "Changed" }).eq("code", "JSY-SS-01");
    await client.from("parameter_defs").update({ max: 999 }).eq("key", "body_length_offset");
    await client.from("option_defs").delete().eq("code", "C01");
    expect(await getBaseArticle(member.client, "JSY-SS-01")).toEqual(expected[0]);
  });
});

describe("what the database refuses even from the server", () => {
  const article = async (): Promise<string> =>
    must(await adminClient().from("base_articles").select("id").eq("code", "JSY-SS-01").single()).id as string;

  it("refuses a bad code, class, status or sample size", async () => {
    const row = { name: "Test", article_type: "ZZZ", production_class: "A", data_label: "Test" };
    expect((await adminClient().from("base_articles").insert({ ...row, code: "bad" })).error).not.toBeNull();
    expect((await adminClient().from("base_articles").insert({ ...row, code: "ZZZ-ZZ-02", production_class: "C" })).error).not.toBeNull();
    expect((await adminClient().from("base_articles").insert({ ...row, code: "ZZZ-ZZ-03", status: "approved" })).error).not.toBeNull();
    expect((await adminClient().from("base_articles").insert({ ...row, code: "YYY-ZZ-04" })).error).not.toBeNull();
    expect((await adminClient().from("base_articles").insert({ ...row, code: "ZZZ-ZZ-05", size_range: ["S"], sample_size: "M" })).error).not.toBeNull();
  });

  it("refuses a range whose default is outside it, and a rule id that is not one", async () => {
    const id = await article();
    const range = { article_id: id, position: 90, key: "test_range", type: "range", min: 0, max: 10, step: 5, default_value: 20, rule_id: "R-PAT-003" };
    expect((await adminClient().from("parameter_defs").insert(range)).error).not.toBeNull();
    expect((await adminClient().from("parameter_defs").insert({ ...range, default_value: 5, rule_id: "pat-3" })).error).not.toBeNull();
    expect((await adminClient().from("parameter_defs").insert({ ...range, type: "enum", enum_values: ["a"], default_value: "b" })).error).not.toBeNull();
  });

  it("refuses an option priced without a currency, a second default in a group, and one with no rule", async () => {
    const id = await article();
    const option = { article_id: id, position: 90, option_group: "collar", code: "C98", label: "Test", rule_id: "R-CON-004" };
    expect((await adminClient().from("option_defs").insert({ ...option, extra_cost_minor: 100 })).error).not.toBeNull();
    expect((await adminClient().from("option_defs").insert({ ...option, is_default: true })).error).not.toBeNull();
    expect((await adminClient().from("option_defs").insert({ ...option, rule_id: null })).error).not.toBeNull();
  });

  it("gives every seeded option a rule id, R-GAP-000 where the build pack names none", async () => {
    const options = must(await adminClient().from("option_defs").select("code, rule_id")) as { code: string; rule_id: string }[];
    expect(options.every((option) => /^R-[A-Z]{2,5}-\d{3}$/.test(option.rule_id))).toBe(true);
    expect(options.filter((option) => option.rule_id === "R-GAP-000").map((option) => option.code).sort()).toEqual(["P00", "P01", "P02"]);
  });

  it("lets the server add and remove an article, its children going with it", async () => {
    const created = must(
      await adminClient()
        .from("base_articles")
        .insert({ code: "ZZZ-ZZ-09", name: "Server test", article_type: "ZZZ", production_class: "B", data_label: "Test, removed below" })
        .select("id")
        .single(),
    ) as { id: string };
    must(await adminClient().from("article_fabrics").insert({ article_id: created.id, position: 0, fabric_code: "F-TEST" }).select("id"));
    must(await adminClient().from("base_articles").delete().eq("id", created.id).select("id"));
    expect(must(await adminClient().from("article_fabrics").select("id").eq("article_id", created.id))).toEqual([]);
  });
});
