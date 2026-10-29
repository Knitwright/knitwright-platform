import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { NEW_TIER_LABEL, addTier, applyEdit } from "./apply";
import { fakeFactoryStore } from "./fixtures/fake-store";
import { ids, tierRows } from "./fixtures/rows";

/**
 * One change at a time from the ops page, after the caller has checked the person is a platform admin
 * (lib/factory/actions.ts does that). A change that would break a price ladder is refused.
 */

const ACTOR = "99999999-9999-4999-8999-999999999999";

const refusal = async (promise: Promise<unknown>): Promise<AppError> => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
};

describe("applyEdit", () => {
  it("writes the parsed columns and records who changed them", async () => {
    const store = fakeFactoryStore();
    const field = await applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "sell_aud_minor", value: "54.00" });
    expect(field.column).toBe("sell_aud_minor");
    expect(store.writes).toEqual([{ table: "price_tiers", id: ids.tier10, columns: { sell_aud_minor: 5400 }, actor: ACTOR }]);
  });

  it("refuses a field the page does not offer, and a value in the wrong shape", async () => {
    const store = fakeFactoryStore();
    expect((await refusal(applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "capability_id", value: "x" }))).message).toBe("That field cannot be changed here.");
    expect((await refusal(applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "sell_gbp_minor", value: "£29" }))).code).toBe("invalid_input");
    expect(store.writes).toEqual([]);
  });

  it("refuses a quantity change that would leave a gap or an overlap in the ladder", async () => {
    const store = fakeFactoryStore();
    expect((await refusal(applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "qty_max", value: "25" }))).message).toBe("Tiers 10-25 and 20-49 overlap.");
    expect((await refusal(applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "qty_max", value: "15" }))).message).toBe("No tier covers 16 to 19 pieces.");
    expect(store.writes).toEqual([]);
  });

  it("allows a quantity change that keeps the ladder whole", async () => {
    const store = fakeFactoryStore();
    await applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "qty_min", value: "5" });
    expect(store.rowsOf("price_tiers")[0]).toMatchObject({ qty_min: 5 });
  });

  it("refuses to clear a tier's starting quantity, and refuses a tier that is not there", async () => {
    const store = fakeFactoryStore();
    expect((await refusal(applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "qty_min", value: "" }))).message).toBe("A tier needs a starting quantity.");
    expect((await refusal(applyEdit(store, ACTOR, { table: "price_tiers", id: ids.gb, column: "qty_min", value: "5" }))).code).toBe("not_found");
  });

  it("clears a tier's upper bound when it is the only tier left in the ladder", async () => {
    const store = fakeFactoryStore({ price_tiers: [tierRows[0]!] });
    await applyEdit(store, ACTOR, { table: "price_tiers", id: ids.tier10, column: "qty_max", value: "" });
    expect(store.rowsOf("price_tiers")[0]).toMatchObject({ qty_max: null });
  });
});

describe("addTier", () => {
  it("adds an empty tier, labelled as having no price yet", async () => {
    const store = fakeFactoryStore();
    await addTier(store, ACTOR, { capabilityId: ids.jersey, qtyMin: 1, qtyMax: 9 });
    expect(store.added).toEqual([{ capabilityId: ids.jersey, qtyMin: 1, qtyMax: 9, label: NEW_TIER_LABEL }]);
    const ladder = await store.ladder(ids.jersey);
    expect(ladder).toHaveLength(4);
    expect(ladder.find((t) => t.qtyMin === 1)).toMatchObject({ sellGbpMinor: null, ruleId: "R-GAP-000", label: NEW_TIER_LABEL });
  });

  it("refuses an upper quantity below the lower one", async () => {
    const store = fakeFactoryStore();
    expect((await refusal(addTier(store, ACTOR, { capabilityId: ids.jersey, qtyMin: 50, qtyMax: 10 }))).message).toBe("The upper quantity is below the lower one.");
    expect(store.added).toEqual([]);
  });

  it("refuses a tier added after an open one, which would hide it", async () => {
    const store = fakeFactoryStore();
    expect((await refusal(addTier(store, ACTOR, { capabilityId: ids.shorts, qtyMin: 50, qtyMax: null }))).message).toBe("Tier 10+ has no upper bound but another tier follows it.");
  });

  it("refuses a tier that would overlap the ladder it joins", async () => {
    const store = fakeFactoryStore();
    expect((await refusal(addTier(store, ACTOR, { capabilityId: ids.jersey, qtyMin: 30, qtyMax: 60 }))).code).toBe("invalid_input");
    expect(store.added).toEqual([]);
  });
});
