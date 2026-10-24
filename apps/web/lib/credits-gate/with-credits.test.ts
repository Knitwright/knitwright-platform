import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { createGate } from "./gate";
import { createWithCredits } from "./with-credits";

const ctx = { session: { userId: "u1", brand: { id: "b1" } }, usage: { eventId: "ev1" } };
type Ctx = typeof ctx;

const setup = (enforced: boolean, balance = 3) => {
  const spend = vi.fn(async (input: { designVersionHash: string }) => ({ hash: input.designVersionHash, ok: true as const, charged: true, price: 1, balance: balance - 1, entryId: "e" }));
  const gate = createGate({
    enforced: () => enforced,
    service: () => ({ spendCredits: spend, ensureMonthlyAllowance: async () => ({ applied: false, balance }) }),
    log: () => {},
    now: () => new Date(0),
  });
  return { spend, withCredits: createWithCredits(gate) };
};

const version = async () => ({ projectId: "p1", version: 2 });

describe("withCredits", () => {
  it("runs the handler untouched when the flag is off, without reading the version", async () => {
    const { withCredits, spend } = setup(false);
    const resolve = vi.fn(version);
    const run = withCredits<Ctx, { a: number }>({ kind: "techpack_pdf", version: resolve, where: "w" }, async () => ({ a: 1 }));
    expect(await run(ctx)).toEqual({ a: 1 });
    expect(resolve).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
  });

  it("never charges a free output, whatever the flag", async () => {
    const { withCredits, spend } = setup(true);
    const run = withCredits<Ctx, string>({ kind: () => null, version, where: "w" }, async () => "free");
    expect(await run(ctx)).toBe("free");
    expect(spend).not.toHaveBeenCalled();
  });

  it("charges before the handler, hands on the usage event and adds the note to an object answer", async () => {
    const { withCredits, spend } = setup(true);
    const run = withCredits<Ctx, { a: number }>({ kind: "marketing_media", version, where: "w" }, async () => ({ a: 1 }));
    expect(await run(ctx)).toEqual({ a: 1, credits: { price: 1, charged: true, balance: 2 } });
    expect(spend).toHaveBeenCalledWith(expect.objectContaining({ kind: "marketing_media", usageEventId: "ev1", brandId: "b1" }));
  });

  it("puts the note in headers of a file answer", async () => {
    const { withCredits } = setup(true);
    const run = withCredits<Ctx, never>({ kind: "pattern_file", version, where: "w" }, async () => new Response("file", { status: 200, headers: { "x-keep": "1" } }));
    const response = (await run(ctx)) as Response;
    expect(await response.text()).toBe("file");
    expect(response.headers.get("x-keep")).toBe("1");
    expect(response.headers.get("x-credits-price")).toBe("1");
    expect(response.headers.get("x-credits-charged")).toBe("true");
    expect(response.headers.get("x-credits-balance")).toBe("2");
  });

  it("refuses with the price and balance and does not run the handler when the balance is short", async () => {
    const spend = async () => ({ ok: false as const, reason: "insufficient" as const, price: 1, balance: 0 });
    const gate = createGate({ enforced: () => true, service: () => ({ spendCredits: spend, ensureMonthlyAllowance: async () => ({ applied: false, balance: 0 }) }), log: () => {}, now: () => new Date(0) });
    const handler = vi.fn(async () => "x");
    const run = createWithCredits(gate)<Ctx, string>({ kind: "techpack_pdf", version, where: "w" }, handler);
    await expect(run(ctx)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("costs 1 credit") });
    await expect(run(ctx)).rejects.toBeInstanceOf(AppError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler without a charge when the version cannot be found out (the handler refuses the request itself)", async () => {
    const { withCredits, spend } = setup(true);
    const run = withCredits<Ctx, string>({ kind: "techpack_pdf", version: async () => null, where: "w" }, async () => "refused by handler");
    expect(await run(ctx)).toBe("refused by handler");
    expect(spend).not.toHaveBeenCalled();
  });

  it("charges the same hash for the same design and version", async () => {
    const { withCredits, spend } = setup(true);
    const run = withCredits<Ctx, string>({ kind: "techpack_pdf", version, where: "w" }, async () => "ok");
    await run(ctx);
    await run(ctx);
    const hashes = spend.mock.calls.map((call) => call[0].designVersionHash);
    expect(hashes[0]).toBe(hashes[1]);
  });
});
