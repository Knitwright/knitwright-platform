import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import type { UsageMeter } from "@/lib/usage/meter";
import { slot } from "../templates/types";
import { ALLOWANCE_USED_UP, meteredWriter, writeCostMicrodollars, writerFor } from "./metered";
import { writeForMe, type WriteRequest, type WriteResult } from "./write";
import type { BrandVoice } from "./voice";

const VOICE: BrandVoice = { brandId: "brand-1", name: "Harrow Town FC", tags: ["bold"], about: null, styles: null };
const ENTRY = MODEL_CATALOG[0];
const WHO = { brandId: "brand-1", userId: "user-1" };

const request: WriteRequest = {
  slot: slot({ id: "headline", kind: "text", label: "Headline", rect: { x: 0.06, y: 0.6, width: 0.88, height: 0.1 }, style: "headline", limit: 40 }),
  highlight: "Pre-orders close Friday",
  campaign: "pre-order",
  voice: VOICE,
};

/** A meter that counts what it was asked, as `lib/inspiration/fixtures/meter.ts` does. */
function countingMeter(allow = true) {
  const state = { reserved: 0, refunded: 0, cost: 0 };
  const meter: UsageMeter = {
    reserve: async ({ cost }) => {
      state.reserved += 1;
      state.cost = cost.microdollars;
      return allow ? { ok: true, eventId: "event-1" } : { ok: false, refused: "brand" };
    },
    refund: async () => {
      state.refunded += 1;
      return true;
    },
  };
  return { meter, state };
}

const ok: WriteResult = { ok: true, options: ["New kit"], model: "stub", usage: { inputTokens: 10, outputTokens: 4 } };

describe("what a run of Write for me costs", () => {
  it("counts the whole prompt and a full reply, in whole microdollars, at least one", () => {
    const cost = writeCostMicrodollars(ENTRY, request);
    expect(cost).toBeGreaterThan(0);
    expect(Number.isInteger(cost)).toBe(true);
  });

  it("costs more on a dearer model, which is the only thing that changes it", () => {
    const cheap = writeCostMicrodollars(MODEL_CATALOG[0], request);
    const dear = writeCostMicrodollars(MODEL_CATALOG[MODEL_CATALOG.length - 1]!, request);
    expect(dear).toBeGreaterThan(cheap);
  });
});

describe("the meter round the writer", () => {
  it("reserves before the call and keeps the cost when words came back", async () => {
    const { meter, state } = countingMeter();
    const writer = meteredWriter(async () => ok, meter, WHO, ENTRY, "POST /api/marketing/copy");

    expect(await writer.write(request)).toEqual(ok);
    expect(state).toMatchObject({ reserved: 1, refunded: 0 });
    expect(state.cost).toBe(writeCostMicrodollars(ENTRY, request));
  });

  it("gives the cost back when nothing usable came back, so nobody pays for an empty answer", async () => {
    const { meter, state } = countingMeter();
    const writer = meteredWriter(async () => ({ ok: false, reason: "nothing", ruleId: "R-GAP-000" }), meter, WHO, ENTRY, "route");

    expect((await writer.write(request)).ok).toBe(false);
    expect(state).toMatchObject({ reserved: 1, refunded: 1 });
  });

  it("gives the cost back when the call threw, and lets the fault through", async () => {
    const { meter, state } = countingMeter();
    const writer = meteredWriter(async () => {
      throw new TypeError("broken");
    }, meter, WHO, ENTRY, "route");

    await expect(writer.write(request)).rejects.toBeInstanceOf(TypeError);
    expect(state).toMatchObject({ reserved: 1, refunded: 1 });
  });

  it("writes nothing when the allowance is used up, and says so in the meter's words", async () => {
    const { meter, state } = countingMeter(false);
    let called = 0;
    const writer = meteredWriter(async () => (called += 1, ok), meter, WHO, ENTRY, "route");

    const result = await writer.write(request);
    expect(result.ok ? "" : result.reason).toBe(ALLOWANCE_USED_UP);
    expect(called).toBe(0);
    expect(state.refunded).toBe(0);
  });

  it("carries on when the refund itself fails, because the answer is already known", async () => {
    const meter: UsageMeter = { reserve: async () => ({ ok: true, eventId: "e" }), refund: async () => Promise.reject(new Error("no")) };
    const writer = meteredWriter(async () => ({ ok: false, reason: "nothing", ruleId: "R-GAP-000" }), meter, WHO, ENTRY, "route");
    expect((await writer.write(request)).ok).toBe(false);
  });

  it("makes no live call in a test: the provider handed in is the deterministic stub", async () => {
    const provider = createStubProvider([JSON.stringify({ options: ["New kit. Out Friday."] })]);
    const { meter } = countingMeter();
    const writer = meteredWriter(writerFor(provider, writeForMe), meter, WHO, ENTRY, "route");

    const result = await writer.write(request);
    expect(result.ok && result.options).toEqual(["New kit. Out Friday."]);
    expect(provider.provider).toBe("stub");
  });
});
