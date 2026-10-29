import { beforeAll, describe, expect, it } from "vitest";
import { createFactoryService } from "@/lib/factory/service";
import { DEFAULT_PRODUCTION_SETTINGS } from "@/lib/factory/production-settings";
import { supabaseFactoryStore } from "@/lib/factory/store";
import { factoryProfileSchema } from "@/lib/validation/profile";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261101050000_factories.sql, through the real store: the seeded factory model, what a member may
 * read of it, what the table checks refuse, and the profile the validation gate gets from the rows
 * (plan v5 X6, decision 0071).
 */

let alice: Person;

const store = () => supabaseFactoryStore(adminClient());

const capabilityId = async (articleCode: string): Promise<string> => {
  const row = must(await adminClient().from("factory_capabilities").select("id").eq("article_code", articleCode).single()) as { id: string };
  return row.id;
};

beforeAll(async () => {
  alice = await person("factories-alice");
  await brandOf(alice, "Alice Athletic");
});

describe("the seeded factory model", () => {
  it("has one placeholder factory in Sialkot, on the factory's own clock", async () => {
    const factories = await store().listFactories();
    expect(factories).toHaveLength(1);
    expect(factories[0]).toMatchObject({ slug: "sialkot-partner", city: "Sialkot", country: "PK", timeZone: "Asia/Karachi", status: "onboarding" });
    expect(factories[0]?.label).toMatch(/placeholder/i);
  });

  it("has the six launch fabric codes, each labelled a placeholder", async () => {
    const fabrics = await store().listFabrics();
    expect(fabrics.map((f) => f.code)).toEqual(["F-POLY-4W", "F-POLY-EL", "F-POLY-INT", "F-POLY-PQ", "F-STK-FLC", "F-STK-TEE"]);
    for (const fabric of fabrics) expect(fabric.label, fabric.code).toMatch(/placeholder/i);
    expect(fabrics.filter((f) => f.productionClass === "B").map((f) => f.code)).toEqual(["F-STK-FLC", "F-STK-TEE"]);
  });

  it("makes JSY-SS-01 and SHO-TR-01, from one piece, with the file set the build pack asks for", async () => {
    const factory = (await store().listFactories())[0]!;
    const snapshot = await store().snapshot(factory);
    expect(snapshot.capabilities.map((c) => c.articleCode).sort()).toEqual(["JSY-SS-01", "SHO-TR-01"]);
    for (const capability of snapshot.capabilities) {
      expect(capability, capability.articleCode).toMatchObject({ moq: 1, leadTimeDays: 8, colourDeltaMax: 1.5, goldenSampleStatus: "none", weeklySlotCapacity: null });
      expect([...capability.fileFormats].sort()).toEqual(["dxf", "eps", "pdf", "svg"]);
    }
  });

  it("holds the club price ladder as rows in pence, and no cost or AUD price anyone has agreed", async () => {
    const ladder = [...(await store().ladder(await capabilityId("JSY-SS-01")))].sort((a, b) => a.qtyMin - b.qtyMin);
    expect(ladder.map((t) => [t.qtyMin, t.qtyMax, t.sellGbpMinor])).toEqual([[10, 19, 2900], [20, 49, 2500], [50, null, 2200]]);
    for (const tier of ladder) {
      expect(tier.cost).toBeNull();
      expect(tier.sellAudMinor).toBeNull();
      expect(tier.ruleId).toBe("R-COST-003");
    }
    expect(await store().ladder(await capabilityId("SHO-TR-01"))).toEqual([]);
  });

  it("opens the UK and Australia and keeps the US and the EU closed, as spec decision 3 says", async () => {
    const rules = await store().listCountryRules();
    expect(rules.map((r) => [r.country, r.sellingEnabled])).toEqual([["AU", true], ["EU", false], ["GB", true], ["US", false]]);
    expect(rules.find((r) => r.country === "GB")).toMatchObject({ currency: "GBP", vatRateBp: 2000, preferenceScheme: "DCTS", freightDays: null });
  });

  it("gives every row that carries a range, an option or a term a rule id", async () => {
    const [fabrics, rules] = await Promise.all([store().listFabrics(), store().listCountryRules()]);
    for (const row of [...fabrics, ...rules]) expect(row.ruleId, row.label).toMatch(/^R-[A-Z]+-\d{3}$/);
    expect(fabrics.filter((f) => f.ruleId === "R-SUB-001").map((f) => f.code)).toEqual(["F-POLY-4W", "F-POLY-EL", "F-POLY-INT", "F-POLY-PQ"]);
    expect(rules.every((r) => r.ruleId === "R-GAP-000")).toBe(true);
  });
});

describe("what the tables refuse", () => {
  it("refuses a cost without its currency, and a currency without a cost", async () => {
    const id = await capabilityId("SHO-TR-01");
    const base = { capability_id: id, qty_min: 100, label: "Test row" };
    expect((await adminClient().from("price_tiers").insert({ ...base, cost_minor: 880 })).error).not.toBeNull();
    expect((await adminClient().from("price_tiers").insert({ ...base, cost_currency: "USD" })).error).not.toBeNull();
  });

  it("refuses an upper quantity below the lower one, and the same starting quantity twice", async () => {
    const id = await capabilityId("JSY-SS-01");
    expect((await adminClient().from("price_tiers").insert({ capability_id: id, qty_min: 100, qty_max: 50, label: "Test row" })).error).not.toBeNull();
    expect((await adminClient().from("price_tiers").insert({ capability_id: id, qty_min: 10, label: "Test row" })).error).not.toBeNull();
  });

  it("refuses an article code, a fabric code and a rule id in the wrong shape", async () => {
    const factory = must(await adminClient().from("factories").select("id").eq("slug", "sialkot-partner").single()) as { id: string };
    const base = { factory_id: factory.id, fabric_code: "F-POLY-PQ", label: "Test row" };
    expect((await adminClient().from("factory_capabilities").insert({ ...base, article_code: "jersey" })).error).not.toBeNull();
    expect((await adminClient().from("factory_capabilities").insert({ ...base, article_code: "AAA-BB-02", rule_id: "nonsense" })).error).not.toBeNull();
    expect((await adminClient().from("factory_capabilities").insert({ ...base, article_code: "AAA-BB-03", fabric_code: "F-NOT-REAL" })).error).not.toBeNull();
  });

  it("refuses a fabric colour without all three Lab readings, and lets nothing delete a fabric", async () => {
    expect((await adminClient().from("programme_fabric_colours").insert({ fabric_code: "F-STK-TEE", name: "Half measured", hex: "#102030", lab_l: 20, label: "Test row" })).error).not.toBeNull();
    // Nothing is granted DELETE on these tables, so a fabric a capability depends on cannot vanish under it.
    expect((await adminClient().from("programme_fabrics").delete().eq("code", "F-POLY-INT")).error).not.toBeNull();
    expect(await store().listFabrics()).toHaveLength(6);
  });
});

describe("who may read the factory model", () => {
  it("shows a signed-in member the fabric programme and the country rules", async () => {
    expect(must(await alice.client.from("programme_fabrics").select("code")).length).toBe(6);
    expect(must(await alice.client.from("country_rules").select("country")).length).toBe(4);
  });

  it("shows a member nothing of the factory, what it makes or what it costs", async () => {
    for (const table of ["factories", "factory_capabilities", "price_tiers"]) {
      const { data } = await alice.client.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("lets a member change nothing, not even a fabric it can read", async () => {
    await alice.client.from("programme_fabrics").update({ name: "Changed by a member" }).eq("code", "F-POLY-INT");
    const [fabric] = await store().listFabrics().then((list) => list.filter((f) => f.code === "F-POLY-INT"));
    expect(fabric?.name).toBe("Polyester interlock");
  });
});

describe("the read model over the real rows", () => {
  it("builds the factory profile the validation gate reads, with nothing invented", async () => {
    const profile = await createFactoryService(store()).profile("sialkot-partner");
    expect(factoryProfileSchema.safeParse(profile).success).toBe(true);
    expect(profile).toMatchObject({
      id: "sialkot-partner",
      articles: [
        { typeId: "football-shirt", moq: { status: "set", value: 1 } },
        { typeId: "football-shorts", moq: { status: "set", value: 1 } },
      ],
      leadTimeDays: { status: "set", value: 8 },
      fileFormats: ["dxf", "eps", "pdf", "svg"],
      hsCodes: { status: "not-set" },
      priceLadder: { status: "set", value: [{ fromPieces: 10, unitPrice: 29 }, { fromPieces: 20, unitPrice: 25 }, { fromPieces: 50, unitPrice: 22 }] },
    });
    expect(profile.label).toMatch(/placeholder/i);
  });

  it("prices a basket from the rows, with the tier counted across the whole basket", async () => {
    const basket = await createFactoryService(store()).price("sialkot-partner", [{ articleCode: "JSY-SS-01", qty: 10 }, { articleCode: "JSY-SS-01", qty: 15 }], "GBP");
    expect(basket.tierQty).toBe(25);
    expect(basket.totalMinor).toBe(62_500);
  });

  it("promises no date while the QC days and the freight days are not agreed", async () => {
    const promise = await createFactoryService(store()).promise(
      { slug: "sialkot-partner", articleCode: "JSY-SS-01", country: "GB", orderAt: new Date("2027-03-03T00:00:00Z") },
      DEFAULT_PRODUCTION_SETTINGS,
    );
    expect(promise).toMatchObject({ status: "not-set", missing: ["the days for QC", "the freight days"] });
    expect(promise.startsAt.toISOString()).toBe("2027-03-08T07:00:00.000Z");
  });
});
