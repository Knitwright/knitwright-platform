import { beforeAll, describe, expect, it } from "vitest";
import { RULEBOOK_MD } from "@/lib/rulebook/fixtures/files";
import { parseRulebookMarkdown } from "@/lib/rulebook/markdown";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * The rulebook (decision 0067): the 45 JSY-SS-01 rules are seeded word for word as drafts, with R-GAP-000; an edit
 * adds a version and never overwrites; only a platform admin edits or confirms; members read the rules but not who
 * wrote them; gaps are counted and hidden from browsers. Needs `pnpm db:start`. Test rules use the R-TEST family so
 * the seeded rules are never changed.
 */

let admin: Person;
let member: Person;

type Row = Record<string, unknown>;

const versions = async (ruleId: string) =>
  must(await adminClient().from("rulebook_entries").select("*").eq("rule_id", ruleId).order("version")) as Row[];

const save = (actor: string | null, ruleId: string, rule: string) =>
  adminClient().rpc("rulebook_entry_save", {
    p_actor: actor,
    p_rule_id: ruleId,
    p_topic: "print",
    p_article_codes: ["JSY-SS-01"],
    p_title: "A test rule",
    p_rule: rule,
    p_body: "Why it is so",
    p_best_practice: "What to do",
    p_source: "knitwright",
    p_source_note: "Test",
  });

const confirm = (actor: string | null, ruleId: string, version: number) =>
  adminClient().rpc("rulebook_entry_confirm", { p_actor: actor, p_rule_id: ruleId, p_version: version });

beforeAll(async () => {
  [admin, member] = await Promise.all([person("rulebook-db-admin"), person("rulebook-db-member")]);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
});

describe("the seed", () => {
  it("holds all 45 rules of the JSY-SS-01 rulebook word for word, as version 1 drafts", async () => {
    const rules = parseRulebookMarkdown(RULEBOOK_MD, "JSY-SS-01");
    const rows = must(
      await adminClient().from("rulebook_entries").select("*").in("rule_id", rules.map((r) => r.ruleId)).eq("version", 1),
    ) as Row[];
    expect(rows).toHaveLength(45);
    for (const r of rules) {
      const row = rows.find((x) => x.rule_id === r.ruleId);
      expect(row, r.ruleId).toMatchObject({
        topic: r.topic,
        article_codes: [...r.articleCodes],
        title: r.title,
        rule: r.rule,
        body: r.body,
        best_practice: r.bestPractice,
        source: r.source,
        source_note: r.sourceNote,
        status: "draft",
        confirmed_at: null,
      });
    }
  });

  it("holds R-GAP-000 with the plan's words", async () => {
    expect((await versions("R-GAP-000"))[0]).toMatchObject({ topic: null, body: "No rule written yet; the team has been told", status: "draft" });
  });
});

describe("versions", () => {
  it("adds a new version on each save and keeps the earlier one as it was", async () => {
    expect(must(await save(admin.userId, "R-TEST-001", "First words"))).toBe(1);
    expect(must(await save(admin.userId, "R-TEST-001", "Second words"))).toBe(2);

    const rows = await versions("R-TEST-001");
    expect(rows.map((r) => [r.version, r.rule, r.status, r.created_by])).toEqual([
      [1, "First words", "draft", admin.userId],
      [2, "Second words", "draft", admin.userId],
    ]);
  });

  it("confirms one version, with who and when, and leaves its words alone", async () => {
    must(await save(admin.userId, "R-TEST-002", "Words"));
    must(await confirm(admin.userId, "R-TEST-002", 1));
    must(await confirm(admin.userId, "R-TEST-002", 1));

    const [row] = await versions("R-TEST-002");
    expect(row).toMatchObject({ status: "confirmed", confirmed_by: admin.userId, rule: "Words" });
    expect(row?.confirmed_at).toBeTruthy();
  });

  it("answers 'not found' to confirming a version that does not exist", async () => {
    expect((await confirm(admin.userId, "R-TEST-404", 1)).error?.code).toBe("P0002");
  });

  it("can never change a version's words or remove it, even with the server's key", async () => {
    must(await save(admin.userId, "R-TEST-003", "Kept"));
    const before = await versions("R-TEST-003");

    // The server's key holds SELECT only, so these are refused before the trigger is reached.
    const update = await adminClient().from("rulebook_entries").update({ rule: "Changed" }).eq("rule_id", "R-TEST-003");
    const remove = await adminClient().from("rulebook_entries").delete().eq("rule_id", "R-TEST-003");
    const insert = await adminClient().from("rulebook_entries").insert({ rule_id: "R-TEST-004", version: 1, title: "t", rule: "r", body: "b", best_practice: "", source: "knitwright" });

    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    expect(insert.error).not.toBeNull();
    expect(await versions("R-TEST-003")).toEqual(before);
  });

  it("refuses a rule id that is not of the form R-ABC-123", async () => {
    expect((await save(admin.userId, "SUB-4", "x")).error).not.toBeNull();
  });
});

describe("who may write", () => {
  it("answers 'not found' to a member and to no actor, and writes nothing", async () => {
    expect((await save(member.userId, "R-TEST-005", "x")).error?.code).toBe("P0002");
    expect((await save(null, "R-TEST-005", "x")).error?.code).toBe("P0002");
    expect((await confirm(member.userId, "R-GAP-000", 1)).error?.code).toBe("P0002");
    expect(await versions("R-TEST-005")).toEqual([]);
    expect((await versions("R-GAP-000"))[0]?.status).toBe("draft");
  });

  it("refuses every function to a browser", async () => {
    for (const client of [anonClient(), member.client, admin.client]) {
      expect((await client.rpc("rulebook_entry_save", { p_actor: admin.userId, p_rule_id: "R-TEST-006", p_topic: "print", p_article_codes: [], p_title: "t", p_rule: "r", p_body: "b", p_best_practice: "", p_source: "knitwright", p_source_note: "" })).error).not.toBeNull();
      expect((await client.rpc("rulebook_entry_confirm", { p_actor: admin.userId, p_rule_id: "R-GAP-000", p_version: 1 })).error).not.toBeNull();
      expect((await client.rpc("rulebook_gap_log", { p_code: "R-TEST-007", p_context: "" })).error).not.toBeNull();
    }
    expect(await versions("R-TEST-006")).toEqual([]);
  });
});

describe("reading", () => {
  it("shows a signed-in member every rule, but not who wrote or confirmed it", async () => {
    const rows = must(await member.client.from("rulebook_entries").select("rule_id, rule, status").eq("rule_id", "R-SUB-004")) as Row[];
    expect(rows[0]).toMatchObject({ rule_id: "R-SUB-004", status: "draft" });

    expect((await member.client.from("rulebook_entries").select("confirmed_by")).error).not.toBeNull();
    expect((await member.client.from("rulebook_entries").select("created_by")).error).not.toBeNull();
  });

  it("shows a visitor nothing", async () => {
    const { data, error } = await anonClient().from("rulebook_entries").select("rule_id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

describe("gaps", () => {
  it("counts each meeting with a code, keeps the first time and the latest context", async () => {
    must(await adminClient().rpc("rulebook_gap_log", { p_code: "R-TEST-900", p_context: "first" }));
    must(await adminClient().rpc("rulebook_gap_log", { p_code: "R-TEST-900", p_context: "" }));
    must(await adminClient().rpc("rulebook_gap_log", { p_code: "R-TEST-900", p_context: "third" }));

    const row = must(await adminClient().from("rulebook_gaps").select("*").eq("code", "R-TEST-900").single()) as Row;
    expect(row).toMatchObject({ count: 3, context: "third" });
    expect(Date.parse(row.last_seen as string)).toBeGreaterThanOrEqual(Date.parse(row.first_seen as string));
  });

  it("shows no browser the gaps", async () => {
    for (const client of [anonClient(), member.client, admin.client]) {
      const { data, error } = await client.from("rulebook_gaps").select("*");
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
  });
});
