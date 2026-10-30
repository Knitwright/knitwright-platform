import { describe, expect, it, vi } from "vitest";
import { callCost, modelEntry } from "@/lib/providers/catalog";
import type { Reservation, UsageMeter } from "@/lib/usage/meter";
import { EXTRACT_MAX_OUTPUT_TOKENS, createStubExtractor } from "./extract";
import { ALLOWANCE_USED_UP, EXTRACT_INPUT_TOKENS_ESTIMATE, extractCostMicrodollars, meteredExtractor } from "./metered";
import { runningShort } from "./fixtures/cards";

/** Every paid call is metered (plan rule). The cost is reserved first and given back when the call fails. */

const WHO = { brandId: "brand-1", userId: "user-1" };
const INPUT = { kind: "url" as const, words: "A running short." };

const meterOf = (reservation: Reservation = { ok: true, eventId: "event-1" }) => {
  const reserve = vi.fn(async () => reservation);
  const refund = vi.fn(async () => true);
  return { meter: { reserve, refund } satisfies UsageMeter, reserve, refund };
};

describe("what one card costs to read", () => {
  it("prices the page's words, the instructions and the whole reply", () => {
    const entry = modelEntry("claude-haiku-4-5");

    expect(extractCostMicrodollars(entry)).toBe(callCost(entry, EXTRACT_INPUT_TOKENS_ESTIMATE, EXTRACT_MAX_OUTPUT_TOKENS));
  });
});

describe("the metered extractor", () => {
  it("reserves the cost against the person and brand who asked, then reads the card", async () => {
    const { meter, reserve, refund } = meterOf();
    const extractor = meteredExtractor(createStubExtractor([runningShort()]), meter, WHO, 700, "benchmark-url");

    expect(extractor.name).toBe("stub");
    expect((await extractor.extract(INPUT)).brandName.value).toBe("Acme");
    expect(reserve).toHaveBeenCalledWith({ userId: "user-1", brandId: "brand-1", cost: { feature: "ai", microdollars: 700 }, route: "benchmark-url" });
    expect(refund).not.toHaveBeenCalled();
  });

  it("does not reach the model at all when the allowance is used up", async () => {
    const { meter } = meterOf({ ok: false, refused: "brand" });
    const stub = createStubExtractor([runningShort()]);

    await expect(meteredExtractor(stub, meter, WHO, 700, "r").extract(INPUT)).rejects.toThrow(ALLOWANCE_USED_UP);
    expect(stub.calls).toBe(0);
  });

  it("gives the cost back when the read fails, and passes the failure on", async () => {
    const { meter, refund } = meterOf();
    const extractor = meteredExtractor(createStubExtractor([new Error("down")]), meter, WHO, 700, "r");

    await expect(extractor.extract(INPUT)).rejects.toThrow("down");
    expect(refund).toHaveBeenCalledWith("event-1");
  });

  it("still passes the failure on when the refund itself fails", async () => {
    const { meter } = meterOf();
    meter.refund = vi.fn(async () => {
      throw new Error("the ledger is down");
    });
    const extractor = meteredExtractor(createStubExtractor([new Error("down")]), meter, WHO, 700, "r");

    await expect(extractor.extract(INPUT)).rejects.toThrow("down");
  });
});
