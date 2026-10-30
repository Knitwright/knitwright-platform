import { beforeAll, describe, expect, it } from "vitest";
import { askRulebook } from "@/lib/rulebook/ask/ask";
import { COVERED, DESIGN, UNCOVERED } from "@/lib/rulebook/ask/fixtures/questions";
import { stubModel } from "@/lib/rulebook/ask/fixtures/stub";
import { databaseRetrieval, searchRulebook, shortlist } from "@/lib/rulebook/ask/retrieve";
import { SUBLIMATION } from "@/lib/rulebook/scope";
import { logGap } from "@/lib/rulebook/store";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * The search behind Ask, against the real database (plan v5 Z2, decision 0083). Needs `pnpm db:start`.
 *
 * The unit tests run the 50-question set through a twin of `rulebook_search` written in TypeScript
 * (`lib/rulebook/ask/fixtures/search.ts`), because they must run without a database. This is where the real SQL
 * is held to the same bar: the same 45 answerable questions must each reach the rule they are about, the same 5
 * must reach nothing, and no browser may call the function or read the column it searches.
 */

let member: Person;

const search = (question: string, scope = DESIGN, limit = 6) => searchRulebook(adminClient(), question, scope, limit);

beforeAll(async () => {
  member = await person("rulebook-search-member");
});

describe("the search function", () => {
  it("finds a rule by the words of its own text, ranked and scored", async () => {
    const hits = await search("How far from a seam should a crest sit?");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((hit) => hit.ruleId)).toContain("R-SUB-004");
    const seam = hits.find((hit) => hit.ruleId === "R-SUB-004");
    expect(seam?.matched).toBeGreaterThanOrEqual(2);
    expect(seam?.asked).toBeGreaterThanOrEqual(seam?.matched ?? 0);
    expect(hits.every((hit, index) => index === 0 || hit.rank <= hits[index - 1].rank)).toBe(true);
  });

  it("answers nothing to a question with no searchable word in it", async () => {
    for (const question of ["", "   ", "the and of it", "?!?"]) expect(await search(question), question).toEqual([]);
  });

  it("is not thrown by punctuation, an address or a rule id in the question", async () => {
    for (const question of ["What about http://example.com/a:b?", "Does R-SUB-004 apply? 100% sure?", "cost $0.80-1.80 'per piece'"]) {
      expect(Array.isArray(await search(question)), question).toBe(true);
    }
  });

  it("holds the limit it is given, between one and fifty", async () => {
    expect((await search("seam print colour hem label cost size fabric", DESIGN, 3))).toHaveLength(3);
    expect((await search("seam print colour hem label cost size fabric", DESIGN, 0)).length).toBeLessThanOrEqual(1);
  });
});

describe("how far a rule reaches, in SQL (owner decision 12)", () => {
  it("keeps the shared rules out of a question about an article alone", async () => {
    const hits = await search("What has to be on the care label?", { articleCode: "JSY-SS-01" });
    expect(hits.map((hit) => hit.ruleId)).not.toContain("R-LAB-002");
  });

  it("reaches them through the method they were scoped to", async () => {
    const hits = await search("What has to be on the care label?", { method: SUBLIMATION });
    expect(hits.map((hit) => hit.ruleId)).toContain("R-LAB-002");
  });

  it("keeps this article's own rules out of a question about another article", async () => {
    const hits = await search("How many notches go on the armhole?", { articleCode: "KNI-NONE-99" });
    expect(hits.map((hit) => hit.ruleId)).not.toContain("R-PAT-006");
  });

  it("matches every rule when nothing in particular is asked about", async () => {
    expect((await search("How many notches go on the armhole?", {})).map((hit) => hit.ruleId)).toContain("R-PAT-006");
  });
});

describe("the 50-question set against the real search", () => {
  it("reaches the rule each of the 45 answerable questions is about", async () => {
    const missed: string[] = [];
    for (const item of COVERED) {
      const hits = shortlist(await search(item.question), 6);
      if (!hits.some((hit) => hit.ruleId === item.expect)) {
        missed.push(`${item.expect}: ${item.question} found ${hits.map((hit) => hit.ruleId).join(", ") || "nothing"}`);
      }
    }
    expect(missed).toEqual([]);
  }, 60_000);

  it("reaches nothing worth answering from for the five the rulebook does not answer", async () => {
    const found: string[] = [];
    for (const item of UNCOVERED) {
      const hits = shortlist(await search(item.question), 6);
      if (hits.length > 0) found.push(`${item.question} found ${hits.map((hit) => hit.ruleId).join(", ")}`);
    }
    expect(found).toEqual([]);
  }, 30_000);
});

describe("asking against the real rulebook", () => {
  const deps = (reader: "member" | "ops") => ({
    retrieval: databaseRetrieval(adminClient()),
    logGap: (gap: { code: string; context: string }) => logGap(adminClient(), gap),
    model: stubModel(),
    reader,
  });

  it("answers a member nothing while every seeded rule is still a draft (owner decision 11)", async () => {
    const result = await askRulebook(deps("member"), { question: COVERED[0].question, scope: DESIGN });
    expect(result.kind).toBe("not_covered");
  });

  it("answers the Knitwright team out of those drafts, every sentence citing a rule that was retrieved", async () => {
    const result = await askRulebook(deps("ops"), { question: "How far from a seam should a crest sit?", scope: DESIGN });
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const retrieved = new Set(result.rules.map((rule) => rule.ruleId));
    expect(result.grade.ok).toBe(true);
    expect(result.grade.cited.every((id) => retrieved.has(id))).toBe(true);
  });

  it("writes a question nothing covers to the gap list", async () => {
    const question = `Is a zipper gusset (${crypto.randomUUID()}) possible?`;
    const result = await askRulebook(deps("ops"), { question, scope: DESIGN });
    expect(result.kind).toBe("not_covered");
    const rows = must(await adminClient().from("rulebook_gaps").select("code, count").like("code", "ask:is a zipper gusset%")) as { code: string }[];
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("who may search", () => {
  it("refuses a browser, signed in or not, and keeps the searched words off the member's read", async () => {
    for (const client of [anonClient(), member.client]) {
      const { error } = await client.rpc("rulebook_search", { p_query: "seam" });
      expect(error).not.toBeNull();
    }
    expect((await member.client.from("rulebook_entries").select("search")).error).not.toBeNull();
  });
});

describe("the read ceiling X2b warned about", () => {
  it("is still a long way off: the table holds far fewer than 500 versions", async () => {
    const { count } = await adminClient().from("rulebook_entries").select("rule_id", { count: "exact", head: true });
    expect(count ?? 0).toBeLessThan(500);
  });
});
