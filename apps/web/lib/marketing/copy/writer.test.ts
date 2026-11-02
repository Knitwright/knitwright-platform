import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import type { ModelChoice } from "@/lib/providers/select";
import type { UsageMeter } from "@/lib/usage/meter";
import { slot } from "../templates/types";
import type { BrandVoice } from "./voice";
import type { WriteRequest } from "./write";
import { WRITE_ROUTE, writerFrom } from "./writer";

const VOICE: BrandVoice = { brandId: "brand-1", name: "Harrow Town FC", tags: ["bold"], about: null, styles: null };
const WHO = { brandId: "brand-1", userId: "user-1" };

const request: WriteRequest = {
  slot: slot({ id: "headline", kind: "text", label: "Headline", rect: { x: 0.06, y: 0.6, width: 0.88, height: 0.1 }, style: "headline", limit: 40 }),
  highlight: "Pre-orders close Friday",
  campaign: "pre-order",
  voice: VOICE,
};

const choice = (answers: readonly string[]): ModelChoice => ({
  primary: { provider: createStubProvider(answers), entry: MODEL_CATALOG[0] },
  retry: null,
});

function countingMeter() {
  const state = { reserved: 0, route: "" };
  const meter: UsageMeter = {
    reserve: async ({ route }) => {
      state.reserved += 1;
      state.route = route;
      return { ok: true, eventId: "event-1" };
    },
    refund: async () => true,
  };
  return { meter, state };
}

describe("the writer the wiring step builds", () => {
  it("writes through the chosen model, metered, against the route it is given", async () => {
    const { meter, state } = countingMeter();
    const writer = writerFrom(choice([JSON.stringify({ options: ["New kit. Out Friday."] })]), meter, WHO);

    const result = await writer!.write(request);

    expect(result.ok && result.options).toEqual(["New kit. Out Friday."]);
    expect(state).toEqual({ reserved: 1, route: WRITE_ROUTE });
  });

  it("answers nothing when no key is set, so the panel says it is not connected", () => {
    const { meter } = countingMeter();
    expect(writerFrom({ primary: null, retry: null }, meter, WHO)).toBeNull();
  });

  it("records the spend against the route it was given, when one is named", async () => {
    const { meter, state } = countingMeter();
    const writer = writerFrom(choice([JSON.stringify({ options: ["New kit"] })]), meter, WHO, "POST /api/elsewhere");

    await writer!.write(request);

    expect(state.route).toBe("POST /api/elsewhere");
  });

  it("does not try a second, stronger model: a marketing line is not worth a second paid call", async () => {
    const { meter } = countingMeter();
    const retry = createStubProvider([JSON.stringify({ options: ["Never asked"] })]);
    const writer = writerFrom(
      { primary: { provider: createStubProvider([]), entry: MODEL_CATALOG[0] }, retry: { provider: retry, entry: MODEL_CATALOG[1]! } },
      meter,
      WHO,
    );

    const result = await writer!.write(request);

    expect(result.ok).toBe(false);
    expect(retry.requests).toEqual([]);
  });
});
