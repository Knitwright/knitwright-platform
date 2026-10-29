import { describe, expect, it, vi } from "vitest";
import { modelEntry } from "@/lib/providers/catalog";
import type { Reservation, UsageMeter } from "@/lib/usage/meter";
import { meteredVision, VISION_INPUT_TOKENS_ESTIMATE, visionCostMicrodollars } from "./metered";
import { createStubVisionCheck } from "./vision";

const IMAGE = { mediaType: "image/png" as const, base64: "AAAA" };
const WHO = { brandId: "brand-1", userId: "user-1" };

const meterOf = (reservation: Reservation = { ok: true, eventId: "event-1" }) => {
  const reserve = vi.fn(async () => reservation);
  const refund = vi.fn(async () => true);
  return { meter: { reserve, refund } satisfies UsageMeter, reserve, refund };
};

describe("what one screening costs", () => {
  it("prices the picture, the instructions and the whole reply, in whole microdollars", () => {
    const entry = modelEntry("claude-haiku-4-5");
    const expected = (VISION_INPUT_TOKENS_ESTIMATE * entry.inputPerMillion + 300 * entry.outputPerMillion) / 1_000_000;
    expect(visionCostMicrodollars(entry)).toBe(Math.round(expected * 1_000_000));
  });

  it("never costs nothing, however cheap the model", () => {
    expect(visionCostMicrodollars({ inputPerMillion: 0, outputPerMillion: 0 })).toBe(1);
  });
});

describe("the metered vision check", () => {
  it("reserves the cost against the person and brand who uploaded, then calls the check", async () => {
    const { meter, reserve, refund } = meterOf();
    const check = meteredVision(createStubVisionCheck(), meter, WHO, 500, "POST /api/artwork");
    expect(check.name).toBe("stub");
    expect(await check.inspect(IMAGE)).toEqual({ marks: [], offensive: false });
    expect(reserve).toHaveBeenCalledWith({ userId: "user-1", brandId: "brand-1", cost: { feature: "ai", microdollars: 500 }, route: "POST /api/artwork" });
    expect(refund).not.toHaveBeenCalled();
  });

  it("does not call the model at all when the allowance is used up", async () => {
    const { meter } = meterOf({ ok: false, refused: "brand" });
    const stub = createStubVisionCheck();
    const check = meteredVision(stub, meter, WHO, 500, "r");
    await expect(check.inspect(IMAGE)).rejects.toThrow(/allowance \(brand\) is used up/);
    expect(stub.calls).toBe(0);
  });

  it("gives the cost back when the call fails, and passes the failure on", async () => {
    const { meter, refund } = meterOf();
    const check = meteredVision(createStubVisionCheck([new Error("down")]), meter, WHO, 500, "r");
    await expect(check.inspect(IMAGE)).rejects.toThrow("down");
    expect(refund).toHaveBeenCalledWith("event-1");
  });

  it("still passes the failure on when the refund itself fails", async () => {
    const reserve = vi.fn(async (): Promise<Reservation> => ({ ok: true, eventId: "event-1" }));
    const meter: UsageMeter = { reserve, refund: async () => { throw new Error("refund down"); } };
    const check = meteredVision(createStubVisionCheck([new Error("down")]), meter, WHO, 500, "r");
    await expect(check.inspect(IMAGE)).rejects.toThrow("down");
  });
});
