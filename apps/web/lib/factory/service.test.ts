import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fakeFactoryStore } from "./fixtures/fake-store";
import { ids } from "./fixtures/rows";
import { DEFAULT_PRODUCTION_SETTINGS } from "./production-settings";
import { capabilityFor, createFactoryService } from "./service";

/**
 * The factory model's use cases: the cached profile, a basket's price and a promised date, all from rows
 * (decision 0071). The store is an interface, so this runs over the in-memory double.
 */

const SETTINGS = { ...DEFAULT_PRODUCTION_SETTINGS, qcDays: 2 };
const ORDER_AT = new Date("2027-03-03T00:00:00Z");

const refusal = async (promise: Promise<unknown>): Promise<AppError> => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
};

describe("capabilityFor", () => {
  it("finds the capability for an article, and for an article on a named fabric", async () => {
    const store = fakeFactoryStore();
    const snapshot = await store.snapshot((await store.listFactories())[0]!);
    expect(capabilityFor(snapshot, "JSY-SS-01")?.id).toBe(ids.jersey);
    expect(capabilityFor(snapshot, "JSY-SS-01", "F-POLY-INT")?.id).toBe(ids.jersey);
    expect(capabilityFor(snapshot, "JSY-SS-01", "F-STK-TEE")).toBeUndefined();
    expect(capabilityFor(snapshot, "HOO-CR-01")).toBeUndefined();
  });
});

describe("profile", () => {
  it("builds the profile from rows and keeps it until a change drops it", async () => {
    const store = fakeFactoryStore();
    const service = createFactoryService(store);
    expect((await service.profile("sialkot-partner")).id).toBe("sialkot-partner");
    await store.update("factories", ids.factory, { name: "Changed" }, "actor");
    expect((await service.profile("sialkot-partner")).name).toBe("Sialkot partner (placeholder)");
    service.invalidate();
    expect((await service.profile("sialkot-partner")).name).toBe("Changed");
  });

  it("says a factory that is not there is not there", async () => {
    const service = createFactoryService(fakeFactoryStore());
    expect((await refusal(service.profile("nobody"))).code).toBe("not_found");
  });
});

describe("price", () => {
  it("prices a basket across both articles at the basket's own tier", async () => {
    const service = createFactoryService(fakeFactoryStore());
    const basket = await service.price("sialkot-partner", [{ articleCode: "JSY-SS-01", qty: 12 }, { articleCode: "JSY-SS-01", qty: 10, fabricCode: "F-POLY-INT" }], "GBP");
    expect(basket.tierQty).toBe(22);
    expect(basket.totalMinor).toBe(55_000);
  });

  it("gives a line of an article the factory does not make no price, and no total", async () => {
    const service = createFactoryService(fakeFactoryStore());
    const basket = await service.price("sialkot-partner", [{ articleCode: "HOO-CR-01", qty: 60 }], "GBP");
    expect(basket.lines[0]?.price).toMatchObject({ status: "not-made" });
    expect(basket.totalMinor).toBeNull();
  });
});

describe("promise", () => {
  const input = { slug: "sialkot-partner", articleCode: "JSY-SS-01", country: "GB", orderAt: ORDER_AT };

  it("counts cut-off plus lead time plus QC plus freight, as spec F-S7 asks", async () => {
    const service = createFactoryService(fakeFactoryStore());
    expect(await service.promise(input, SETTINGS)).toMatchObject({ status: "set", readyForQcOn: "2027-03-18", shipsOn: "2027-03-22", promisedOn: "2027-03-26" });
  });

  it("promises nothing while the QC days or the freight days are not agreed", async () => {
    const service = createFactoryService(fakeFactoryStore());
    expect(await service.promise(input, DEFAULT_PRODUCTION_SETTINGS)).toMatchObject({ status: "not-set" });
    expect(await service.promise({ ...input, country: "AU" }, SETTINGS)).toMatchObject({ status: "not-set", missing: ["the freight days"] });
  });

  it("takes the production class from the capability's fabric unless it is given", async () => {
    const service = createFactoryService(fakeFactoryStore());
    const classA = await service.promise(input, SETTINGS);
    const classB = await service.promise({ ...input, productionClass: "B" }, SETTINGS);
    expect(classA.startsAt.toISOString()).toBe("2027-03-08T07:00:00.000Z");
    expect(classB.startsAt.toISOString()).toBe(ORDER_AT.toISOString());
  });

  it("falls back to Class A when no fabric card explains the capability", async () => {
    const store = fakeFactoryStore({ programme_fabrics: [] });
    const service = createFactoryService(store);
    expect((await service.promise(input, SETTINGS)).startsAt.toISOString()).toBe("2027-03-08T07:00:00.000Z");
  });

  it("refuses an article the factory does not make and a country that is not open", async () => {
    const service = createFactoryService(fakeFactoryStore());
    expect((await refusal(service.promise({ ...input, articleCode: "HOO-CR-01" }, SETTINGS))).message).toBe("This factory does not make that article.");
    expect((await refusal(service.promise({ ...input, country: "US" }, SETTINGS))).message).toBe("Knitwright does not deliver to that country yet.");
    expect((await refusal(service.promise({ ...input, country: "ZZ" }, SETTINGS))).code).toBe("invalid_input");
  });
});
