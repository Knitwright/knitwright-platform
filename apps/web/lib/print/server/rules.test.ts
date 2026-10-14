import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/fabrics/fixtures/fake-db";
import { AppError } from "@/lib/server/core/errors";
import { EMPTY_RULES } from "../rules";
import { MAX_RULE_SETS, RULE_SET_NOT_FOUND, TOO_MANY_RULE_SETS, createRuleSet, deleteRuleSet, listRuleSets, rulesFor } from "./rules";
import { leagueRuleSetInputSchema } from "./schemas";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const input = leagueRuleSetInputSchema.parse({
  name: "State league",
  source: "Competition rules 2026, section 4",
  rules: { minTextHeightMm: 30, minLineMm: null, coloursToAvoid: [], numberRules: { minHeightMm: 200, maxHeightMm: 300, allowedDigits: null, source: "Rules s4.2" } },
});
const expectApp = async (promise: Promise<unknown>, code: string, message?: string) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  if (message) expect((error as AppError).message).toBe(message);
};

describe("league rule sets", () => {
  it("saves a rule set with its source, lists the brand's own, and uses it for a download", async () => {
    const db = fakeDb();
    const id = await createRuleSet(db.client, who, input);
    await createRuleSet(db.client, { ...who, brandId: "33333333-3333-4333-8333-333333333333" }, { ...input, name: "Theirs" });
    const listed = await listRuleSets(db.client, who.brandId);
    expect(listed.map((r) => r.name)).toEqual(["State league"]);
    expect(listed[0].source).toBe("Competition rules 2026, section 4");
    expect((await rulesFor(db.client, who.brandId, id)).minTextHeightMm).toBe(30);
    expect(await rulesFor(db.client, who.brandId, undefined)).toEqual(EMPTY_RULES);
    await expectApp(rulesFor(db.client, who.brandId, "44444444-4444-4444-8444-444444444444"), "not_found", RULE_SET_NOT_FOUND);
  });
  it("refuses a rule set with no source, and too many", async () => {
    expect(leagueRuleSetInputSchema.safeParse({ ...input, source: "  " }).success).toBe(false);
    const rows = Array.from({ length: MAX_RULE_SETS }, (_, i) => ({ id: `id-${i}`, brand_id: who.brandId }));
    await expectApp(createRuleSet(fakeDb({ league_rule_sets: rows }).client, who, input), "invalid_input", TOO_MANY_RULE_SETS);
  });
  it("removes only the brand's own rule set", async () => {
    const db = fakeDb();
    const id = await createRuleSet(db.client, who, input);
    await expectApp(deleteRuleSet(db.client, { ...who, brandId: "33333333-3333-4333-8333-333333333333" }, id), "not_found");
    await deleteRuleSet(db.client, who, id);
    expect(await listRuleSets(db.client, who.brandId)).toEqual([]);
  });
  it("reports a database failure", async () => {
    const db = fakeDb();
    db.failOn("league_rule_sets", "select", { message: "boom" });
    await expect(listRuleSets(db.client, who.brandId)).rejects.toThrow(/could not be read/);
    const db2 = fakeDb();
    db2.failOn("league_rule_sets", "insert", { code: "23505", message: "dup" });
    await expectApp(createRuleSet(db2.client, who, input), "conflict");
  });
});
