import { describe, expect, it } from "vitest";
import { SUBMIT_ORDER_FUNCTION, submitOrderForProduction, submitOrderInputSchema, submitOrderResultSchema, SubmitOrderError } from "./contract";

const RELEASE = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
const valid = { releaseId: RELEASE, externalRef: "store-order-1001", factoryProfileId: "knitwright-default", fabricKey: "mesh-140", articleId: "team-jersey", sizes: { M: 10, L: 5 }, valueMinor: 125000, currency: "AUD" };

describe("submitOrderInputSchema", () => {
  it("accepts a complete order and counts nothing the Store did not say", () => {
    expect(submitOrderInputSchema.parse(valid)).toEqual(valid);
  });

  it("allows the value to be left out, but only as a pair with its currency", () => {
    expect(submitOrderInputSchema.safeParse({ ...valid, valueMinor: null, currency: null }).success).toBe(true);
    expect(submitOrderInputSchema.safeParse({ ...valid, valueMinor: 100, currency: null }).success).toBe(false);
    expect(submitOrderInputSchema.safeParse({ ...valid, valueMinor: null, currency: "AUD" }).success).toBe(false);
  });

  it.each([
    ["no sizes", { sizes: {} }],
    ["a zero quantity", { sizes: { M: 0 } }],
    ["a fractional quantity", { sizes: { M: 1.5 } }],
    ["a huge quantity", { sizes: { M: 100000 } }],
    ["a blank size label", { sizes: { "": 1 } }],
    ["a bad release id", { releaseId: "nope" }],
    ["an empty reference", { externalRef: " " }],
    ["a lower-case currency", { currency: "aud" }],
    ["a negative value", { valueMinor: -1 }],
    ["a fractional value", { valueMinor: 10.5 }],
  ])("refuses %s", (_name, change) => {
    expect(submitOrderInputSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe("submitOrderForProduction", () => {
  const result = { order_id: "9f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", status: "submitted", cutoff_at: "2026-10-23T17:00:00+00:00", promised_on: null, lead_time_days: null, created: true };

  it("calls the documented function with the documented arguments and reads the answer", async () => {
    const calls: unknown[] = [];
    const client = { rpc: async (name: string, args: unknown) => (calls.push([name, args]), { data: [result], error: null }) };
    const out = await submitOrderForProduction(client as never, valid);
    expect(calls).toEqual([
      [
        SUBMIT_ORDER_FUNCTION,
        { p_release_id: RELEASE, p_external_ref: "store-order-1001", p_factory_profile_id: "knitwright-default", p_fabric_key: "mesh-140", p_article_id: "team-jersey", p_sizes: { M: 10, L: 5 }, p_value_minor: 125000, p_currency: "AUD" },
      ],
    ]);
    expect(out).toEqual({ orderId: result.order_id, status: "submitted", cutoffAt: "2026-10-23T17:00:00.000Z", promisedOn: null, leadTimeDays: null, created: true });
  });

  it.each([
    ["release_not_found", "release_not_found"],
    ["external_ref_conflict", "external_ref_conflict"],
    ["invalid_sizes", "invalid_sizes"],
  ])("turns the database hint %s into a typed error", async (hint, code) => {
    const client = { rpc: async () => ({ data: null, error: { code: "P0001", message: "x", hint } }) };
    await expect(submitOrderForProduction(client as never, valid)).rejects.toMatchObject({ name: "SubmitOrderError", code });
  });

  it("does not call the database when the input is wrong", async () => {
    let called = false;
    const client = { rpc: async () => ((called = true), { data: null, error: null }) };
    await expect(submitOrderForProduction(client as never, { ...valid, sizes: {} })).rejects.toBeInstanceOf(SubmitOrderError);
    expect(called).toBe(false);
  });

  it("fails loudly on an answer it does not understand", async () => {
    const client = { rpc: async () => ({ data: [{ nonsense: 1 }], error: null }) };
    await expect(submitOrderForProduction(client as never, valid)).rejects.toMatchObject({ code: "unexpected_answer" });
  });
});

describe("submitOrderResultSchema", () => {
  it("needs a real status", () => {
    expect(submitOrderResultSchema.safeParse({ order_id: "9f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", status: "paid", cutoff_at: "2026-10-23T17:00:00Z", promised_on: null, lead_time_days: null, created: true }).success).toBe(false);
  });
});
