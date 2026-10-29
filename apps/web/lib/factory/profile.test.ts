import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_LABEL, defaultFactoryProfile, factoryProfileSchema } from "@/lib/validation/profile";
import { fakeFactoryStore } from "./fixtures/fake-store";
import { capabilityRows, factoryRow, tierRows } from "./fixtures/rows";
import { buildFactoryProfile } from "./profile";
import { toCapability, toFabric, toFactory, toTier } from "./rows";
import type { FactorySnapshot } from "./schemas";

/**
 * The factory profile read model (spec 03-data-model.md). It must produce the very type the validation gate
 * already reads (lib/validation/profile.ts, decision 0039), so a design validates against rows instead of
 * against a hand-written JSON column, and a value no row gives stays "not-set".
 */

const snapshot = async (): Promise<FactorySnapshot> => {
  const store = fakeFactoryStore();
  return store.snapshot((await store.listFactories())[0]!);
};

const bare = (over: Partial<FactorySnapshot> = {}): FactorySnapshot => ({
  factory: toFactory(factoryRow),
  capabilities: [],
  tiers: [],
  fabrics: [],
  ...over,
});

describe("buildFactoryProfile", () => {
  it("produces exactly the type the validation gate reads", async () => {
    expect(factoryProfileSchema.safeParse(buildFactoryProfile(await snapshot())).success).toBe(true);
  });

  it("names the profile after the factory's slug, and carries the row's own source line", async () => {
    expect(buildFactoryProfile(await snapshot())).toMatchObject({ id: "sialkot-partner", name: "Sialkot partner (placeholder)", label: "Test row, not a factory quote" });
  });

  it("lists one article per garment type, with the smallest agreed minimum order", async () => {
    const profile = buildFactoryProfile(await snapshot());
    expect(profile.articles).toEqual([
      { typeId: "football-shirt", moq: { status: "set", value: 1 } },
      { typeId: "football-shorts", moq: { status: "set", value: 5 } },
    ]);
  });

  it("falls back to the article code in lower case while no garment type maps to it", () => {
    const capability = toCapability({ ...capabilityRows[0]!, garment_type_id: null });
    expect(buildFactoryProfile(bare({ capabilities: [capability] })).articles[0]).toEqual({ typeId: "jsy-ss-01", moq: { status: "set", value: 1 } });
  });

  it("lists each fabric once with its swatch and the strictest agreed colour difference", async () => {
    expect(buildFactoryProfile(await snapshot()).fabrics).toEqual([
      { name: "F-POLY-INT Polyester interlock", swatchRef: "SW-INT-01", colourDelta: { status: "set", value: 1.5 } },
    ]);
  });

  it("names a fabric by its code alone when the programme has no card for it", () => {
    const profile = buildFactoryProfile(bare({ capabilities: [toCapability(capabilityRows[0]!)] }));
    expect(profile.fabrics).toEqual([{ name: "F-POLY-INT", swatchRef: null, colourDelta: { status: "set", value: 1.5 } }]);
  });

  it("takes the longest lead time, so no article is promised sooner than it can be made", async () => {
    expect(buildFactoryProfile(await snapshot()).leadTimeDays).toEqual({ status: "set", value: 10 });
  });

  it("gathers the file formats of every capability, in lower case and without repeats", async () => {
    expect(buildFactoryProfile(await snapshot()).fileFormats).toEqual(["dxf", "eps", "pdf", "svg"]);
  });

  it("gives the GBP ladder in pounds, from the first capability whose every tier has a GBP price", async () => {
    expect(buildFactoryProfile(await snapshot()).priceLadder).toEqual({
      status: "set",
      value: [
        { fromPieces: 10, unitPrice: 29 },
        { fromPieces: 20, unitPrice: 25 },
        { fromPieces: 50, unitPrice: 22 },
      ],
    });
  });

  it("has no ladder while a tier of every capability is missing its GBP price", () => {
    const capabilities = [toCapability(capabilityRows[0]!)];
    const tiers = [toTier({ ...tierRows[0]!, sell_gbp_minor: null })];
    expect(buildFactoryProfile(bare({ capabilities, tiers })).priceLadder).toEqual({ status: "not-set" });
  });

  it("keeps the seeded discipline: a value no row gives is not-set, never a guess", () => {
    const empty = buildFactoryProfile(bare());
    const seeded = defaultFactoryProfile();
    expect(Object.keys(empty).sort()).toEqual(Object.keys(seeded).sort());
    expect(empty).toMatchObject({
      articles: [],
      fabrics: [],
      structuralOptions: seeded.structuralOptions,
      priceLadder: seeded.priceLadder,
      leadTimeDays: seeded.leadTimeDays,
      fileFormats: seeded.fileFormats,
      hsCodes: seeded.hsCodes,
    });
    // The old profile's label says nobody has agreed it; a row says who agreed this one.
    expect(seeded.label).toBe(DEFAULT_PROFILE_LABEL);
    expect(empty.label).not.toBe(DEFAULT_PROFILE_LABEL);
  });

  it("builds every fabric card into the profile even when a capability uses none of them", () => {
    const fabrics = [toFabric({ id: factoryRow.id, code: "F-POLY-PQ", name: "Pique", production_class: "A", blend: "100% polyester", gsm_min: null, gsm_max: null, stretch: null, finish: null, pfas_free: null, oeko_tex_cert: null, sublimatable: true, swatch_ref: null, rule_id: "R-SUB-001", label: "Test row" })];
    expect(buildFactoryProfile(bare({ fabrics })).fabrics).toEqual([]);
  });
});
