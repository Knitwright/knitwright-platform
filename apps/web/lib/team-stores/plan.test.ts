import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { FIXTURE_LADDER, NOW } from "./fixtures/stores";
import { NO_NAME_LIMIT, NOT_LISTED, NO_RELEASE, planStore, type StoreContext } from "./plan";
import { buySchema, clubPageSchema, openStoreSchema, windowOf } from "./schemas";

const CONTEXT: StoreContext = {
  brandId: "b", userId: "u", projectId: "p", productId: "prod", releaseId: "rel", factoryProfileId: "knitwright-default", fabricKey: "mesh-140",
  ladder: FIXTURE_LADDER, sizeRun: ["S", "M", "L", "XL"], nameMax: 12, whyNoRun: null,
};
const CHOICES = { title: "U16s home", marginBps: 1000, minPieces: 10, sizes: ["XL", "S"], namesNumbers: true, seasonId: null, opensAt: "2026-11-13T12:00:00.000Z", closesAt: "2026-11-27T23:59:59.000Z" };

const refused = (run: () => unknown): AppError | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error as AppError;
  }
};

describe("a new store", () => {
  it("is priced at the minimum's tier, sells the chosen sizes in the size run's order, and keeps the name zone's length", () => {
    const store = planStore(CONTEXT, CHOICES, "Ab3dEf7hJk", []);
    expect(store).toMatchObject({ unitMinor: 2900, marginBps: 1000, sizes: ["S", "XL"], nameMax: 12, currency: "GBP", productId: "prod", releaseId: "rel" });
    expect(store.priceLabel).toMatch(/^Priced at the 10-piece tier, the store's minimum\. Placeholder/);
    expect(planStore(CONTEXT, { ...CHOICES, minPieces: 25 }, "c", []).unitMinor).toBe(2500);
    expect(planStore({ ...CONTEXT, nameMax: null }, { ...CHOICES, namesNumbers: false }, "c", []).nameMax).toBe(1);
  });

  it("is refused, in words the kit manager can act on, when it cannot open", () => {
    expect(refused(() => planStore({ ...CONTEXT, whyNoRun: "No golden sample." }, CHOICES, "c", []))?.message).toBe("No golden sample.");
    expect(refused(() => planStore({ ...CONTEXT, productId: null }, CHOICES, "c", []))?.message).toBe(NOT_LISTED);
    expect(refused(() => planStore({ ...CONTEXT, releaseId: null }, CHOICES, "c", []))?.message).toBe(NO_RELEASE);
    expect(refused(() => planStore({ ...CONTEXT, nameMax: null }, CHOICES, "c", []))?.message).toBe(NO_NAME_LIMIT);
    expect(refused(() => planStore(CONTEXT, { ...CHOICES, sizes: ["XXXL"] }, "c", []))?.code).toBe("invalid_input");
    expect(refused(() => planStore(CONTEXT, { ...CHOICES, minPieces: 5 }, "c", []))?.message).toMatch(/needs a price/);
    expect(refused(() => planStore({ ...CONTEXT, ladder: [] }, CHOICES, "c", []))?.message).toMatch(/No price is on file/);
  });
});

describe("the forms", () => {
  const open = { projectId: "00000000-0000-4000-8000-000000000c01", title: " U16s ", marginBps: "500", minPieces: "10", sizes: ["M"], namesNumbers: true, seasonId: null, opensOn: "2026-11-13", closesOn: "2026-11-27" };

  it("take a store's choices and refuse a margin off the list and dates the wrong way round", () => {
    expect(openStoreSchema.parse(open)).toMatchObject({ title: "U16s", marginBps: 500, minPieces: 10 });
    expect(openStoreSchema.safeParse({ ...open, marginBps: "700" }).success).toBe(false);
    expect(openStoreSchema.safeParse({ ...open, closesOn: "2026-11-01" }).success).toBe(false);
  });

  it("open at the start of the first day, or now, and close at the end of the last", () => {
    expect(windowOf({ opensOn: "2026-11-13", closesOn: "2026-11-27" }, NOW)).toEqual({ opensAt: NOW.toISOString(), closesAt: "2026-11-27T23:59:59.000Z" });
    expect(windowOf({ opensOn: "2026-11-20", closesOn: "2026-11-27" }, NOW).opensAt).toBe("2026-11-20T00:00:00.000Z");
  });

  it("take a buyer's pieces as one field, shirt names cleaned and in capitals", () => {
    const parsed = buySchema.parse({
      code: "Ab3dEf7hJk", requestKey: "00000000-0000-4000-8000-000000000001", buyerName: " Sam ", buyerEmail: "Sam@Example.TEST",
      lines: JSON.stringify([{ size: "M", name: " khan ", number: "10" }, { size: "S" }]), "cf-turnstile-response": "t",
    });
    expect(parsed.buyerEmail).toBe("sam@example.test");
    expect(parsed.lines).toEqual([{ size: "M", name: "KHAN", number: "10" }, { size: "S", name: "", number: "" }]);
    expect(buySchema.safeParse({ code: "Ab3dEf7hJk", lines: "not json" }).success).toBe(false);
    expect(buySchema.safeParse({ code: "Ab3dEf7hJk", requestKey: "00000000-0000-4000-8000-000000000001", buyerName: "S", buyerEmail: "s@example.test", lines: JSON.stringify([{ size: "M", name: "<script>" }]), "cf-turnstile-response": "t" }).success).toBe(false);
  });

  it("take a club page's address in lower case and a tick as published", () => {
    expect(clubPageSchema.parse({ slug: " Lions ", contact: "", published: "on" })).toEqual({ slug: "lions", contact: "", published: true });
    expect(clubPageSchema.parse({ slug: "lions", contact: "x", published: false }).published).toBe(false);
  });
});
