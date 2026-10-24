import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LogEvent } from "@/lib/server/core/guard";
import { createGate, type GateService } from "./gate";

const REQUEST = { brandId: "brand-1", userId: "user-1", kind: "techpack_pdf", designVersionHash: "h1" } as const;

/** A tiny in-memory ledger with the same rules as the database function: one charge per (kind, version). */
const fakeService = (opening: number, price = 1) => {
  let balance = opening;
  const charged = new Set<string>();
  const calls = { spend: 0, allowance: 0 };
  const service: GateService = {
    ensureMonthlyAllowance: async () => {
      calls.allowance += 1;
      return { applied: false, balance };
    },
    spendCredits: async (input) => {
      calls.spend += 1;
      const key = `${input.kind}:${input.designVersionHash}`;
      if (charged.has(key)) return { ok: true, charged: false, price, balance, entryId: null };
      if (balance < price) return { ok: false, reason: "insufficient", price, balance };
      balance -= price;
      charged.add(key);
      return { ok: true, charged: true, price, balance, entryId: key };
    },
  };
  return { service, calls, balance: () => balance };
};

const gateOf = (enforced: boolean, service: GateService, logs: LogEvent[] = []) =>
  createGate({ enforced: () => enforced, service: () => service, log: (event) => logs.push(event), now: () => new Date("2026-10-26T00:00:00Z") });

describe("the credit gate", () => {
  it("with the flag off charges nothing, touches no service, and logs what would have been spent", async () => {
    const f = fakeService(5);
    const logs: LogEvent[] = [];
    const answer = await gateOf(false, f.service, logs).check({ ...REQUEST, where: "GET /x" });
    expect(answer).toEqual({ ok: true, note: null });
    expect(f.calls).toEqual({ spend: 0, allowance: 0 });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.message).toMatch(/would have cost 1 credit/);
  });

  it("with the flag on gives the month's credits, charges once and reports the balance", async () => {
    const f = fakeService(5);
    const answer = await gateOf(true, f.service).check({ ...REQUEST, where: "GET /x" });
    expect(answer).toEqual({ ok: true, note: { price: 1, charged: true, balance: 4 } });
    expect(f.calls.allowance).toBe(1);
  });

  it("does not charge a second download of the same version", async () => {
    const f = fakeService(5);
    const gate = gateOf(true, f.service);
    await gate.check({ ...REQUEST, where: "w" });
    const again = await gate.check({ ...REQUEST, where: "w" });
    expect(again).toEqual({ ok: true, note: { price: 1, charged: false, balance: 4 } });
  });

  it("refuses in plain words naming the price and the balance, and changes nothing", async () => {
    const f = fakeService(0, 2);
    const answer = await gateOf(true, f.service).check({ ...REQUEST, where: "w" });
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.message).toContain("Full tech pack PDF costs 2 credits");
    expect(answer.message).toContain("balance is 0");
    expect(answer.message).toMatch(/placeholder/i);
    expect(f.balance()).toBe(0);
  });

  it("passes the paid call's usage event on to the ledger line", async () => {
    const seen: unknown[] = [];
    const service: GateService = {
      ensureMonthlyAllowance: async () => ({ applied: false, balance: 3 }),
      spendCredits: async (input) => {
        seen.push(input.usageEventId);
        return { ok: true, charged: true, price: 1, balance: 2, entryId: "e" };
      },
    };
    await gateOf(true, service).check({ ...REQUEST, usageEventId: "event-9", where: "w" });
    expect(seen).toEqual(["event-9"]);
  });

  it("property: never charges more than once per version and kind, and never goes below zero", () =>
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 6 }),
        fc.array(fc.tuple(fc.constantFrom("marketing_media", "techpack_pdf", "pattern_file"), fc.constantFrom("v1", "v2", "v3")), { maxLength: 30 }),
        async (opening, asks) => {
          const f = fakeService(opening);
          const gate = gateOf(true, f.service);
          for (const [kind, hash] of asks) await gate.check({ ...REQUEST, kind, designVersionHash: hash, where: "w" });
          const distinct = new Set(asks.map(([k, h]) => `${k}:${h}`)).size;
          expect(f.balance()).toBeGreaterThanOrEqual(0);
          expect(opening - f.balance()).toBeLessThanOrEqual(distinct);
        },
      ),
    ));

  it("property: with the flag off the balance never moves", () =>
    fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 10 }), async (opening, times) => {
        const f = fakeService(opening);
        const gate = gateOf(false, f.service);
        for (let i = 0; i < times; i += 1) await gate.check({ ...REQUEST, where: "w" });
        expect(f.balance()).toBe(opening);
      }),
    ));
});
