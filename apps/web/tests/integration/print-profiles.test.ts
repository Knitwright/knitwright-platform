import { beforeAll, describe, expect, it } from "vitest";
import { leagueRulesInputSchema, loadPrintProfile, printProfileInputSchema, saveLeagueRules, savePrintProfile } from "@/lib/print/profiles";
import { adminClient, brandOf, person, type Person } from "./support";

/** Migration 20261015030000, through the real service: print profiles and league rule sets. */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const rules = (name: string) =>
  leagueRulesInputSchema.parse({ name, source: "League rule book 2026", rules: { minTextHeightMm: 50, minLineMm: null, coloursToAvoid: [], numberRules: null } });

beforeAll(async () => {
  alice = await person("alice");
  bob = await person("bob");
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob Sports");
});

describe("print profiles in the database", () => {
  it("gives the defaults, then keeps what the server saves and a member re-reads it", async () => {
    expect((await loadPrintProfile(alice.client, aliceBrand)).source).toBe("knitwright-default");
    await savePrintProfile(adminClient(), { brandId: aliceBrand, userId: alice.userId }, printProfileInputSchema.parse({ bleedMm: 12.5, dpi: 200, minDpi: 100, iccFileId: null, maxPrintWidthMm: 1600 }));
    expect(await loadPrintProfile(alice.client, aliceBrand)).toMatchObject({ bleedMm: 12.5, dpi: 200, minDpi: 100, maxPrintWidthMm: 1600, source: "print-house" });
  });

  it("does not show a brand's profile to another brand's member", async () => {
    await savePrintProfile(adminClient(), { brandId: bobBrand, userId: bob.userId }, printProfileInputSchema.parse({ bleedMm: 5, dpi: 300, minDpi: 300, iccFileId: null, maxPrintWidthMm: null }));
    const { data } = await alice.client.from("print_profiles").select("brand_id");
    expect(data).toEqual([{ brand_id: aliceBrand }]);
    expect((await loadPrintProfile(alice.client, bobBrand)).source).toBe("knitwright-default");
  });

  it("lets no browser session write, change or remove a profile", async () => {
    const row = { brand_id: aliceBrand, bleed_mm: 10, dpi: 150, min_dpi: 150, source: "print-house", updated_by: alice.userId };
    expect((await alice.client.from("print_profiles").insert(row)).error).not.toBeNull();
    await alice.client.from("print_profiles").update({ bleed_mm: 1 }).eq("brand_id", aliceBrand);
    await alice.client.from("print_profiles").delete().eq("brand_id", aliceBrand);
    const { data } = await adminClient().from("print_profiles").select("bleed_mm").eq("brand_id", aliceBrand).single();
    expect(Number(data?.bleed_mm)).toBe(12.5);
  });

  it("refuses a bleed, dpi, width or source the check constraints do not allow", async () => {
    const row = { brand_id: aliceBrand, updated_by: alice.userId, source: "print-house" };
    const update = (patch: Record<string, unknown>) => adminClient().from("print_profiles").update(patch).eq("brand_id", aliceBrand);
    expect((await update({ bleed_mm: 101 })).error).not.toBeNull();
    expect((await update({ bleed_mm: -1 })).error).not.toBeNull();
    expect((await update({ dpi: 71 })).error).not.toBeNull();
    expect((await update({ min_dpi: 1201 })).error).not.toBeNull();
    expect((await update({ max_print_width_mm: 0 })).error).not.toBeNull();
    expect((await update({ source: "guess" })).error).not.toBeNull();
    expect((await adminClient().from("print_profiles").insert({ ...row, bleed_mm: 15 })).error).not.toBeNull();
  });

  it("refuses a colour profile file that is not the brand's own print file", async () => {
    const path = `${bobBrand}/print/${crypto.randomUUID()}.tiff`;
    const { data, error } = await adminClient()
      .from("files")
      .insert({ brand_id: bobBrand, bucket: "exports", path, kind: "print", content_type: "image/tiff", bytes: 10, created_by: bob.userId })
      .select("id")
      .single();
    expect(error).toBeNull();
    const result = await adminClient().from("print_profiles").update({ icc_file_id: data?.id }).eq("brand_id", aliceBrand);
    expect(result.error).not.toBeNull();
    const own = await adminClient().from("print_profiles").update({ icc_file_id: data?.id }).eq("brand_id", bobBrand);
    expect(own.error).toBeNull();
  });
});

describe("league rule sets in the database", () => {
  it("keeps a rule set, shows it to the brand's member only, and refuses browser writes", async () => {
    const id = await saveLeagueRules(adminClient(), { brandId: aliceBrand, userId: alice.userId }, rules("County league"));
    const own = await alice.client.from("league_rule_sets").select("id, source");
    expect(own.data).toEqual([{ id, source: "League rule book 2026" }]);
    expect((await bob.client.from("league_rule_sets").select("id")).data).toEqual([]);
    expect((await alice.client.from("league_rule_sets").insert({ brand_id: aliceBrand, name: "x", source: "y", rules: {}, created_by: alice.userId })).error).not.toBeNull();
    await alice.client.from("league_rule_sets").delete().eq("id", id);
    expect((await adminClient().from("league_rule_sets").select("id").eq("id", id)).data).toHaveLength(1);
  });

  it("refuses a name used twice in a brand, whatever its case, but not in another brand", async () => {
    await expect(saveLeagueRules(adminClient(), { brandId: aliceBrand, userId: alice.userId }, rules("COUNTY LEAGUE"))).rejects.toThrow();
    await expect(saveLeagueRules(adminClient(), { brandId: bobBrand, userId: bob.userId }, rules("County league"))).resolves.toBeTruthy();
  });

  it("refuses a rule set with no source", async () => {
    const row = { brand_id: aliceBrand, name: "No source", source: " ", rules: {}, created_by: alice.userId };
    expect((await adminClient().from("league_rule_sets").insert(row)).error).not.toBeNull();
  });
});
