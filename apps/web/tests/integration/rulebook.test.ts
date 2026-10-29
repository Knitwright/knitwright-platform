import { beforeAll, describe, expect, it } from "vitest";
import { RULEBOOK_MD } from "@/lib/rulebook/fixtures/files";
import { familyOf, parseRulebookMarkdown, SHARED_FAMILIES } from "@/lib/rulebook/markdown";
import { SCOPE_NOT_REVIEWED, SUBLIMATION } from "@/lib/rulebook/scope";
import type { RuleSource } from "@/lib/rulebook/constants";
import { misfiledAsFactory, sourceOf } from "@/lib/rulebook/sources";
import { resolveRule } from "@/lib/rulebook/store";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * The rulebook (decision 0067, with the revision of owner decisions 11 to 14): the 45 JSY-SS-01 rules are seeded
 * word for word as drafts, with R-GAP-000; an edit adds a version and never overwrites; only a platform admin edits
 * or confirms; members read the rules but not which account recorded a confirmation; gaps are counted and hidden
 * from browsers. The four shared families are scoped to the sublimation method, nothing is filed as the factory's
 * word that the factory did not say, a confirmation names the factory person, and a "Why?" resolves to the newest
 * confirmed version for a member and to the newest version for the team. Needs `pnpm db:start`. Test rules use the
 * R-TEST family so the seeded rules are never changed.
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
    p_scope_methods: [SUBLIMATION],
    p_scope_note: SCOPE_NOT_REVIEWED,
    p_title: "A test rule",
    p_rule: rule,
    p_body: "Why it is so",
    p_best_practice: "What to do",
    p_source: "knitwright",
    p_source_note: "Test",
  });

const confirm = (actor: string | null, ruleId: string, version: number, name = "Ana Lima", role = "pattern master") =>
  adminClient().rpc("rulebook_entry_confirm", { p_actor: actor, p_rule_id: ruleId, p_version: version, p_name: name, p_role: role });

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
      const share = SHARED_FAMILIES.has(familyOf(r.ruleId));
      expect(row, r.ruleId).toMatchObject({
        topic: r.topic,
        article_codes: [...r.articleCodes],
        // Owner decision 12: the shared families reach as far as the sublimation method, not every article.
        scope_methods: share ? [SUBLIMATION] : [],
        scope_note: share ? SCOPE_NOT_REVIEWED : "",
        title: r.title,
        rule: r.rule,
        body: r.body,
        best_practice: r.bestPractice,
        // Owner decision 13: the note is unchanged, word for word; the kind it is filed under is the one in force.
        source: sourceOf(r.sourceNote),
        source_note: r.sourceNote,
        status: "draft",
        confirmed_at: null,
        confirmed_name: null,
        confirmed_role: null,
      });
    }
  });

  it("holds R-GAP-000 with the plan's words, claiming no scope at all", async () => {
    expect((await versions("R-GAP-000"))[0]).toMatchObject({
      topic: null,
      body: "No rule written yet; the team has been told",
      status: "draft",
      article_codes: [],
      scope_methods: [],
    });
  });

  it("files nothing as the factory's word that the factory did not say (owner decision 13)", async () => {
    const rows = must(await adminClient().from("rulebook_entries").select("rule_id, source, source_note")) as Row[];
    const misfiled = rows
      .filter((row) => misfiledAsFactory({ source: row.source as RuleSource, sourceNote: row.source_note as string }))
      .map((row) => row.rule_id);
    expect(misfiled).toEqual([]);
    expect(rows.find((row) => row.rule_id === "R-COST-003")).toMatchObject({
      source: "supplier",
      source_note: "Supplier price lists, May 2026; replace with partner quote",
    });
    expect(rows.find((row) => row.rule_id === "R-COST-002")).toMatchObject({ source: "factory", source_note: "Factory price list" });
  });

  it("files nothing under pattern_master while owner decision 10 holds that no master pattern exists", async () => {
    const rows = must(await adminClient().from("rulebook_entries").select("rule_id").eq("source", "pattern_master")) as Row[];
    expect(rows).toEqual([]);
  });

  it("leaves no seeded rule claiming a scope wider than its source (owner decision 12)", async () => {
    const rows = must(await adminClient().from("rulebook_entries").select("rule_id, article_codes, scope_methods")) as Row[];
    const wide = rows
      .filter((row) => row.rule_id !== "R-GAP-000")
      .filter((row) => (row.article_codes as string[]).length === 0 && (row.scope_methods as string[]).length === 0)
      .map((row) => row.rule_id);
    expect(wide).toEqual([]);
  });

  it("stays small enough to be read whole, which is how rulesFor filters it", async () => {
    // rulesFor reads every version and filters in TypeScript, and PostgREST stops a read at max_rows = 1000
    // (supabase/config.toml, which the plan forbids editing). Past 500 versions of real rules the read needs an
    // index on (rule_id, version) and a filter in SQL instead; decision 0067's revision section says so.
    const { count, error } = await adminClient()
      .from("rulebook_entries")
      .select("rule_id", { count: "exact", head: true })
      .not("rule_id", "like", "R-TEST-%");
    expect(error).toBeNull();
    expect(count ?? 0).toBeLessThan(500);
  });

  it("takes the supplier source kind, and no kind the enum does not name", async () => {
    expect(must(await save(admin.userId, "R-TEST-020", "A supplier said so"))).toBeGreaterThan(0);
    const supplier = await adminClient().rpc("rulebook_entry_save", {
      p_actor: admin.userId, p_rule_id: "R-TEST-021", p_topic: "cost", p_article_codes: ["JSY-SS-01"],
      p_scope_methods: [], p_scope_note: "", p_title: "t", p_rule: "r", p_body: "b", p_best_practice: "",
      p_source: "supplier", p_source_note: "Supplier price lists, May 2026",
    });
    expect(supplier.error).toBeNull();
    const invented = await adminClient().rpc("rulebook_entry_save", {
      p_actor: admin.userId, p_rule_id: "R-TEST-022", p_topic: "cost", p_article_codes: ["JSY-SS-01"],
      p_scope_methods: [], p_scope_note: "", p_title: "t", p_rule: "r", p_body: "b", p_best_practice: "",
      p_source: "a friend", p_source_note: "",
    });
    expect(invented.error).not.toBeNull();
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

  it("confirms one version, with the factory person, the account that recorded it and when", async () => {
    const version = must(await save(admin.userId, "R-TEST-002", "Words")) as number;
    must(await confirm(admin.userId, "R-TEST-002", version));
    must(await confirm(admin.userId, "R-TEST-002", version));

    const row = (await versions("R-TEST-002")).find((r) => r.version === version);
    expect(row).toMatchObject({
      status: "confirmed",
      confirmed_by: admin.userId,
      confirmed_name: "Ana Lima",
      confirmed_role: "pattern master",
      rule: "Words",
    });
    expect(row?.confirmed_at).toBeTruthy();
  });

  it("refuses a confirmation by nobody in particular, and leaves the version a draft (owner decision 14)", async () => {
    const version = must(await save(admin.userId, "R-TEST-011", "Words")) as number;
    for (const [name, role] of [["", "pattern master"], ["  ", " "], ["Ana Lima", ""]]) {
      expect((await confirm(admin.userId, "R-TEST-011", version, name, role)).error?.code).toBe("P0001");
    }
    expect((await adminClient().rpc("rulebook_entry_confirm", {
      p_actor: admin.userId, p_rule_id: "R-TEST-011", p_version: version, p_name: null, p_role: null,
    })).error).not.toBeNull();
    expect((await versions("R-TEST-011")).find((r) => r.version === version)).toMatchObject({ status: "draft", confirmed_name: null });
  });

  it("has no way left to confirm a rule without naming the person", async () => {
    const anonymous = await adminClient().rpc("rulebook_entry_confirm", { p_actor: admin.userId, p_rule_id: "R-TEST-002", p_version: 1 });
    expect(anonymous.error).not.toBeNull();
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

  it("still refuses to change a version after the follow-up migration corrected the seed", async () => {
    // The migration switched the guard off for its two corrections and switched it straight back on.
    const enabled = must(await adminClient().rpc("rulebook_entry_save", {
      p_actor: admin.userId, p_rule_id: "R-TEST-012", p_topic: "print", p_article_codes: ["JSY-SS-01"],
      p_scope_methods: [], p_scope_note: "", p_title: "t", p_rule: "Kept", p_body: "b", p_best_practice: "",
      p_source: "knitwright", p_source_note: "Test",
    })) as number;
    const before = await versions("R-TEST-012");
    const changed = await adminClient().from("rulebook_entries").update({ scope_note: "widened" }).eq("rule_id", "R-TEST-012");
    expect(changed.error).not.toBeNull();
    expect(await versions("R-TEST-012")).toEqual(before);
    expect(enabled).toBeGreaterThan(0);
  });
});

describe("which version a reader is shown (owner decision 11)", () => {
  let base = 0;

  beforeAll(async () => {
    base = must(await save(admin.userId, "R-TEST-013", "Confirmed words")) as number;
    must(await confirm(admin.userId, "R-TEST-013", base));
    must(await save(admin.userId, "R-TEST-013", "Draft words, waiting for the factory"));
  });

  it("shows a member the newest confirmed version and tells them a newer draft is waiting", async () => {
    const resolved = await resolveRule(adminClient(), "R-TEST-013", "member");
    expect(resolved.shown).toMatchObject({ version: base, rule: "Confirmed words", confirmedName: "Ana Lima", confirmedRole: "pattern master" });
    expect(resolved.newerDraft).toMatchObject({ version: base + 1 });
  });

  it("shows the Knitwright team the draft itself", async () => {
    const resolved = await resolveRule(adminClient(), "R-TEST-013", "ops");
    expect(resolved.shown).toMatchObject({ version: base + 1, rule: "Draft words, waiting for the factory", status: "draft" });
    expect(resolved.newerDraft).toBeNull();
  });

  it("reads the same way through a member's own client, which may read the scope and the reviewer", async () => {
    const resolved = await resolveRule(member.client, "R-TEST-013", "member");
    expect(resolved.shown).toMatchObject({
      version: base,
      rule: "Confirmed words",
      confirmedName: "Ana Lima",
      methods: [SUBLIMATION],
      scopeNote: SCOPE_NOT_REVIEWED,
    });
    expect(resolved.newerDraft).toMatchObject({ version: base + 1 });
  });

  it("shows a member nothing at all for a rule the factory has confirmed no version of", async () => {
    must(await save(admin.userId, "R-TEST-014", "Only ever a draft"));
    const resolved = await resolveRule(member.client, "R-TEST-014", "member");
    expect(resolved.shown).toBeNull();
    expect(resolved.newest).not.toBeNull();
    expect((await resolveRule(member.client, "R-TEST-014", "ops")).shown).not.toBeNull();
  });

  it("shows nothing at all for an id with no rule behind it", async () => {
    expect(await resolveRule(member.client, "R-NONE-998", "member")).toEqual({ shown: null, newerDraft: null, newest: null });
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
      expect((await client.rpc("rulebook_entry_save", { p_actor: admin.userId, p_rule_id: "R-TEST-006", p_topic: "print", p_article_codes: ["JSY-SS-01"], p_scope_methods: [], p_scope_note: "", p_title: "t", p_rule: "r", p_body: "b", p_best_practice: "", p_source: "knitwright", p_source_note: "" })).error).not.toBeNull();
      expect((await client.rpc("rulebook_entry_confirm", { p_actor: admin.userId, p_rule_id: "R-GAP-000", p_version: 1, p_name: "Ana Lima", p_role: "pattern master" })).error).not.toBeNull();
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
