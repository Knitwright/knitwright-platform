import { describe, expect, it, vi } from "vitest";
import { MODEL_CATALOG, designImportMaxCost } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import { ModelCallError } from "@/lib/providers/text-model";
import { ProviderError, type ImageProvider } from "@/lib/providers/image-provider";
import type { RouteUsage } from "@/lib/server/core/metered";
import { OVER_ALLOWANCE, editCost, meterEdits, meterVision, spentMicrodollars, visionCost } from "./cost";

const entry = MODEL_CATALOG[5];
const usageWith = (reserve: RouteUsage["reserve"]): RouteUsage => ({ eventId: "e", refund: async () => undefined, reserve });
const held = () => {
  const refund = vi.fn(async () => undefined);
  return { refund, usage: { eventId: "h", refund, reserve: async () => null } satisfies RouteUsage };
};
const request = { system: "s", user: "u", maxOutputTokens: 10 };

describe("cost", () => {
  it("reads vision cost from the model's token price and edit cost from the catalogue", () => {
    expect(visionCost(entry)).toMatchObject({ feature: "ai" });
    expect(visionCost(entry).microdollars).toBeGreaterThan(10_000);
    expect(editCost()).toEqual({ feature: "photoreal", microdollars: 80_000 });
    expect(spentMicrodollars(entry, { visionCalls: 3, imageEdits: 2 })).toBe(designImportMaxCost(entry).total);
    expect(spentMicrodollars(entry, { visionCalls: 0, imageEdits: 0 })).toBe(0);
  });
});

describe("meterVision", () => {
  it("lets the first call use the held reservation and reserves each later one", async () => {
    const reserve = vi.fn(async () => held().usage);
    const metered = meterVision(createStubProvider(["a", "b"]), entry, usageWith(reserve));
    await metered.complete(request);
    expect(reserve).not.toHaveBeenCalled();
    await metered.complete(request);
    expect(reserve).toHaveBeenCalledWith(visionCost(entry));
  });

  it("gives a later reservation back when the call fails, and refuses when the allowance does", async () => {
    const one = held();
    const failing = meterVision(createStubProvider(["a", new ModelCallError("down")]), entry, usageWith(async () => one.usage));
    await failing.complete(request);
    await expect(failing.complete(request)).rejects.toThrow("down");
    expect(one.refund).toHaveBeenCalledOnce();
    const refused = meterVision(createStubProvider(["a", "b"]), entry, usageWith(async () => null));
    await refused.complete(request);
    await expect(refused.complete(request)).rejects.toThrow(OVER_ALLOWANCE);
  });

  it("passes straight through with no reservation held", async () => {
    const stub = createStubProvider(["a", "b"]);
    const metered = meterVision(stub, entry, null);
    await metered.complete(request);
    await metered.complete(request);
    expect(stub.requests).toHaveLength(2);
    expect(metered.model).toBe(stub.model);
  });
});

describe("meterEdits", () => {
  const image: ImageProvider = { name: "i", generate: async () => ({ bytes: new Uint8Array(1), contentType: "image/png" }) };
  const ask = { prompt: "p", reference: new Uint8Array(1) };

  it("reserves against the picture allowance for each edit", async () => {
    const reserve = vi.fn(async () => held().usage);
    await meterEdits(image, usageWith(reserve)).generate(ask);
    expect(reserve).toHaveBeenCalledWith(editCost());
    await meterEdits(image, null).generate(ask);
  });

  it("refunds a failed edit and refuses without allowance", async () => {
    const one = held();
    const failing: ImageProvider = { name: "f", generate: async () => { throw new ProviderError("no", false); } };
    await expect(meterEdits(failing, usageWith(async () => one.usage)).generate(ask)).rejects.toThrow("no");
    expect(one.refund).toHaveBeenCalledOnce();
    await expect(meterEdits(image, usageWith(async () => null)).generate(ask)).rejects.toThrow(OVER_ALLOWANCE);
  });
});
