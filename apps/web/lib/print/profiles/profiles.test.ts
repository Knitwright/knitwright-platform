import { describe, expect, it } from "vitest";
import { DEFAULT_LABEL, printRuleSetSchema } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";
import { fakeDb } from "@/lib/fabrics/fixtures/fake-db";
import {
  DEFAULT_PRINT_PROFILE,
  DEFAULT_PRINT_RULES,
  ICC_NOT_FOUND,
  RULES_NAME_TAKEN,
  RULES_NOT_FOUND,
  TOO_MANY_RULE_SETS,
  deleteLeagueRules,
  leagueRulesInputSchema,
  listLeagueRules,
  loadPrintProfile,
  printProfileInputSchema,
  profileNotes,
  saveLeagueRules,
  savePrintProfile,
  storedPrintProfileSchema,
  updateLeagueRules,
} from ".";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const fileId = "44444444-4444-4444-8444-444444444444";
const input = printProfileInputSchema.parse({ bleedMm: 12, dpi: 200, minDpi: 100, iccFileId: null, maxPrintWidthMm: 1600 });
const rules = leagueRulesInputSchema.parse({
  name: "County league",
  source: "League rule book 2026, section 4",
  rules: { minTextHeightMm: 50, minLineMm: null, coloursToAvoid: ["#ffffff"], numberRules: null },
});

const expectApp = async (promise: Promise<unknown>, code: string, message?: string) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  if (message) expect((error as AppError).message).toBe(message);
};

describe("schemas and defaults", () => {
  it("defaults are labelled, valid and frozen", () => {
    expect(storedPrintProfileSchema.parse(DEFAULT_PRINT_PROFILE)).toEqual(DEFAULT_PRINT_PROFILE);
    expect(DEFAULT_PRINT_PROFILE).toMatchObject({ bleedMm: 15, dpi: 150, minDpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" });
    expect(Object.isFrozen(DEFAULT_PRINT_PROFILE)).toBe(true);
    expect(DEFAULT_PRINT_RULES.source).toBe(DEFAULT_LABEL);
    expect(printRuleSetSchema.parse({ ...DEFAULT_PRINT_RULES, source: undefined })).toMatchObject({ coloursToAvoid: [], numberRules: null });
  });

  it("refuses a bad bleed, dpi or width", () => {
    const base = { bleedMm: 15, dpi: 150, minDpi: 150, iccFileId: null, maxPrintWidthMm: null };
    expect(printProfileInputSchema.safeParse({ ...base, bleedMm: 101 }).success).toBe(false);
    expect(printProfileInputSchema.safeParse({ ...base, bleedMm: -1 }).success).toBe(false);
    expect(printProfileInputSchema.safeParse({ ...base, dpi: 71 }).success).toBe(false);
    expect(printProfileInputSchema.safeParse({ ...base, maxPrintWidthMm: 0 }).success).toBe(false);
  });

  it("refuses a lowest dpi above the dpi", () => {
    const result = printProfileInputSchema.safeParse({ bleedMm: 15, dpi: 150, minDpi: 300, iccFileId: null, maxPrintWidthMm: null });
    expect(result.success).toBe(false);
  });

  it("requires a name and a source for league rules", () => {
    expect(leagueRulesInputSchema.safeParse({ ...rules, source: " " }).success).toBe(false);
    expect(leagueRulesInputSchema.safeParse({ ...rules, name: "" }).success).toBe(false);
  });
});

describe("profileNotes", () => {
  it("says the defaults are defaults and that nothing was set", () => {
    const notes = profileNotes(DEFAULT_PRINT_PROFILE, []);
    expect(notes).toContain("Bleed 15 mm and 150 dpi are Knitwright defaults, not from your print house.");
    expect(notes).toContain("No colours to avoid are set, so none were checked.");
    expect(notes).toContain("No league rules are set: check with the competition.");
    expect(notes.length).toBe(7);
  });

  it("stays quiet about what the brand has set", () => {
    const profile = { ...DEFAULT_PRINT_PROFILE, source: "print-house" as const, iccFileId: fileId, maxPrintWidthMm: 1600 };
    const full = { ...rules.rules, minLineMm: 1 };
    const notes = profileNotes(profile, [full]);
    expect(notes).toEqual(["Bleed 15 mm and 150 dpi are the settings you saved from your print house."]);
  });
});

describe("print profile service", () => {
  it("gives the defaults when nothing is saved", async () => {
    expect(await loadPrintProfile(fakeDb().client, who.brandId)).toEqual(DEFAULT_PRINT_PROFILE);
  });

  it("saves, marks it as the print house's, and saves again over it", async () => {
    const db = fakeDb();
    await savePrintProfile(db.client, who, input);
    expect(await loadPrintProfile(db.client, who.brandId)).toEqual({ ...input, source: "print-house" });
    await savePrintProfile(db.client, who, { ...input, bleedMm: 20 });
    expect(db.tables.print_profiles).toHaveLength(1);
    expect((await loadPrintProfile(db.client, who.brandId)).bleedMm).toBe(20);
  });

  it("reads numbers the database sends as text", async () => {
    const db = fakeDb({ print_profiles: [{ brand_id: who.brandId, bleed_mm: "12.5", dpi: 200, min_dpi: 100, icc_file_id: null, max_print_width_mm: "1600", source: "print-house" }] });
    expect(await loadPrintProfile(db.client, who.brandId)).toMatchObject({ bleedMm: 12.5, maxPrintWidthMm: 1600 });
  });

  it("only reads its own brand's profile", async () => {
    const db = fakeDb();
    await savePrintProfile(db.client, { ...who, brandId: "33333333-3333-4333-8333-333333333333" }, input);
    expect(await loadPrintProfile(db.client, who.brandId)).toEqual(DEFAULT_PRINT_PROFILE);
  });

  it("accepts a print or pattern source file of the brand as the colour profile", async () => {
    const db = fakeDb({ files: [{ id: fileId, brand_id: who.brandId, kind: "print" }] });
    await savePrintProfile(db.client, who, { ...input, iccFileId: fileId });
    expect((await loadPrintProfile(db.client, who.brandId)).iccFileId).toBe(fileId);
    db.tables.files![0]!.kind = "pattern-source";
    await savePrintProfile(db.client, who, { ...input, iccFileId: fileId });
  });

  it("refuses another brand's file, or a file of another kind", async () => {
    const other = fakeDb({ files: [{ id: fileId, brand_id: "33333333-3333-4333-8333-333333333333", kind: "print" }] });
    await expectApp(savePrintProfile(other.client, who, { ...input, iccFileId: fileId }), "not_found", ICC_NOT_FOUND);
    const photo = fakeDb({ files: [{ id: fileId, brand_id: who.brandId, kind: "photo" }] });
    await expectApp(savePrintProfile(photo.client, who, { ...input, iccFileId: fileId }), "not_found", ICC_NOT_FOUND);
  });

  it("turns database failures into plain errors", async () => {
    const db = fakeDb();
    db.failOn("print_profiles", "upsert", { message: "boom" });
    await expect(savePrintProfile(db.client, who, input)).rejects.toThrow("The print profile could not be saved.");
    db.failOn("print_profiles", "select", { message: "boom" });
    await expect(loadPrintProfile(db.client, who.brandId)).rejects.toThrow("The print profile could not be read.");
  });

  it("refuses a row it does not understand", async () => {
    const db = fakeDb({ print_profiles: [{ brand_id: who.brandId, bleed_mm: "x" }] });
    await expect(loadPrintProfile(db.client, who.brandId)).rejects.toThrow("unexpected answer");
  });
});

describe("league rules service", () => {
  it("adds, lists, updates and removes a rule set", async () => {
    const db = fakeDb();
    const id = await saveLeagueRules(db.client, who, rules);
    const [listed] = await listLeagueRules(db.client, who.brandId);
    expect(listed).toMatchObject({ id, name: "County league", source: rules.source });
    await updateLeagueRules(db.client, who, id, { ...rules, name: "County league 2" });
    expect((await listLeagueRules(db.client, who.brandId))[0]?.name).toBe("County league 2");
    await deleteLeagueRules(db.client, who, id);
    expect(await listLeagueRules(db.client, who.brandId)).toEqual([]);
  });

  it("does not touch another brand's rule set", async () => {
    const db = fakeDb();
    const id = await saveLeagueRules(db.client, { ...who, brandId: "33333333-3333-4333-8333-333333333333" }, rules);
    await expectApp(updateLeagueRules(db.client, who, id, rules), "not_found", RULES_NOT_FOUND);
    await expectApp(deleteLeagueRules(db.client, who, id), "not_found", RULES_NOT_FOUND);
    expect(await listLeagueRules(db.client, who.brandId)).toEqual([]);
  });

  it("says when a name is taken", async () => {
    const db = fakeDb();
    db.failOn("league_rule_sets", "insert", { code: "23505", message: "duplicate" });
    await expectApp(saveLeagueRules(db.client, who, rules), "conflict", RULES_NAME_TAKEN);
    const db2 = fakeDb({ league_rule_sets: [{ id: "55555555-5555-4555-8555-555555555555", brand_id: who.brandId }] });
    db2.failOn("league_rule_sets", "update", { code: "23505", message: "duplicate" });
    await expectApp(updateLeagueRules(db2.client, who, "55555555-5555-4555-8555-555555555555", rules), "conflict", RULES_NAME_TAKEN);
  });

  it("refuses more rule sets than a brand may keep", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `id-${i}`, brand_id: who.brandId }));
    await expectApp(saveLeagueRules(fakeDb({ league_rule_sets: rows }).client, who, rules), "invalid_input", TOO_MANY_RULE_SETS);
  });

  it("turns database failures into plain errors", async () => {
    const db = fakeDb();
    db.failOn("league_rule_sets", "select", { message: "boom" });
    await expect(listLeagueRules(db.client, who.brandId)).rejects.toThrow("could not be read");
    await expect(saveLeagueRules(db.client, who, rules)).rejects.toThrow("could not be counted");
    const db2 = fakeDb();
    db2.failOn("league_rule_sets", "insert", { message: "boom" });
    await expect(saveLeagueRules(db2.client, who, rules)).rejects.toThrow("could not be saved");
    db2.failOn("league_rule_sets", "update", { message: "boom" });
    await expect(updateLeagueRules(db2.client, who, fileId, rules)).rejects.toThrow("could not be saved");
    db2.failOn("league_rule_sets", "delete", { message: "boom" });
    await expect(deleteLeagueRules(db2.client, who, fileId)).rejects.toThrow("could not be removed");
  });

  it("refuses a rule row it does not understand", async () => {
    const db = fakeDb({ league_rule_sets: [{ id: "x", brand_id: who.brandId }] });
    await expect(listLeagueRules(db.client, who.brandId)).rejects.toThrow("unexpected answer");
  });
});
