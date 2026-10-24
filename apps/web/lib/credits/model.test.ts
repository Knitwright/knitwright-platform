import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { balanceOf } from "./ledger";
import { OUTPUT_KINDS, type OutputKind } from "./kinds";
import { EMPTY_LEDGER, expireCredits, grantCredits, refundForVersion, spendCredits, type Ledger } from "./model";

const at = "2026-10-01T00:00:00.000Z";
const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const funded = (amount: number): Ledger => grantCredits(EMPTY_LEDGER, { amount, key: "start", id: "g", at }).ledger;

describe("spendCredits", () => {
  it("takes the price and records which output on which version", () => {
    const next = spendCredits(funded(10), { kind: "techpack_pdf", hash: "h1", price: 3, id: "s1", at });
    expect(next).toMatchObject({ ok: true, charged: true });
    expect(balanceOf(next.ledger)).toBe(7);
  });

  it("charges the same output of the same version only once", () => {
    const first = spendCredits(funded(10), { kind: "techpack_pdf", hash: "h1", price: 3, id: "s1", at });
    const again = spendCredits(first.ledger, { kind: "techpack_pdf", hash: "h1", price: 3, id: "s2", at });
    expect(again).toMatchObject({ ok: true, charged: false });
    expect(balanceOf(again.ledger)).toBe(7);
  });

  it("charges a different output, or a different version, separately", () => {
    let ledger = funded(10);
    ledger = spendCredits(ledger, { kind: "techpack_pdf", hash: "h1", price: 2, id: "s1", at }).ledger;
    ledger = spendCredits(ledger, { kind: "pattern_file", hash: "h1", price: 2, id: "s2", at }).ledger;
    ledger = spendCredits(ledger, { kind: "techpack_pdf", hash: "h2", price: 2, id: "s3", at }).ledger;
    expect(balanceOf(ledger)).toBe(4);
  });

  it("refuses when the balance is short and leaves the ledger as it was", () => {
    const start = funded(2);
    const result = spendCredits(start, { kind: "techpack_pdf", hash: "h1", price: 3, id: "s1", at });
    expect(result).toMatchObject({ ok: false, reason: "insufficient" });
    expect(result.ledger).toBe(start);
  });

  it("records nothing for a free output", () => {
    const start = funded(2);
    const result = spendCredits(start, { kind: "techpack_pdf", hash: "h1", price: 0, id: "s1", at });
    expect(result).toMatchObject({ ok: true, charged: false });
    expect(result.ledger).toBe(start);
  });
});

describe("refundForVersion", () => {
  it("gives back every spend on that version, and only that version", () => {
    let ledger = funded(10);
    ledger = spendCredits(ledger, { kind: "techpack_pdf", hash: "h1", price: 2, id: "s1", at }).ledger;
    ledger = spendCredits(ledger, { kind: "pattern_file", hash: "h1", price: 3, id: "s2", at }).ledger;
    ledger = spendCredits(ledger, { kind: "techpack_pdf", hash: "h2", price: 1, id: "s3", at }).ledger;
    const refunded = refundForVersion(ledger, { hash: "h1", ids: ids(), at });
    expect(refunded.refunded).toBe(5);
    expect(balanceOf(refunded.ledger)).toBe(9);
  });

  it("refunds a spend only once", () => {
    let ledger = funded(10);
    ledger = spendCredits(ledger, { kind: "techpack_pdf", hash: "h1", price: 4, id: "s1", at }).ledger;
    const once = refundForVersion(ledger, { hash: "h1", ids: ids(), at });
    const twice = refundForVersion(once.ledger, { hash: "h1", ids: ids(), at });
    expect(twice.refunded).toBe(0);
    expect(balanceOf(twice.ledger)).toBe(10);
  });
});

describe("grantCredits and expireCredits", () => {
  it("applies a grant once per key", () => {
    const first = grantCredits(EMPTY_LEDGER, { amount: 5, key: "allowance:2026-10", id: "g1", at });
    const again = grantCredits(first.ledger, { amount: 5, key: "allowance:2026-10", id: "g2", at });
    expect(again.applied).toBe(false);
    expect(balanceOf(again.ledger)).toBe(5);
  });

  it("expires no more than the balance", () => {
    expect(expireCredits(funded(3), { amount: 4, key: "x", id: "e", at }).applied).toBe(false);
    expect(balanceOf(expireCredits(funded(3), { amount: 2, key: "x", id: "e", at }).ledger)).toBe(1);
  });
});

type Step =
  | { op: "grant"; amount: number; key: number }
  | { op: "spend"; kind: OutputKind; hash: number; price: number }
  | { op: "refund"; hash: number }
  | { op: "expire"; amount: number; key: number };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ op: fc.constant("grant" as const), amount: fc.integer({ min: 1, max: 50 }), key: fc.integer({ min: 0, max: 5 }) }),
  fc.record({
    op: fc.constant("spend" as const),
    kind: fc.constantFrom(...OUTPUT_KINDS),
    hash: fc.integer({ min: 0, max: 3 }),
    price: fc.integer({ min: 0, max: 8 }),
  }),
  fc.record({ op: fc.constant("refund" as const), hash: fc.integer({ min: 0, max: 3 }) }),
  fc.record({ op: fc.constant("expire" as const), amount: fc.integer({ min: 1, max: 20 }), key: fc.integer({ min: 0, max: 5 }) }),
);

const run = (steps: readonly Step[]): Ledger => {
  const next = ids();
  return steps.reduce<Ledger>((ledger, step) => {
    if (step.op === "grant") return grantCredits(ledger, { amount: step.amount, key: `g${step.key}`, id: next(), at }).ledger;
    if (step.op === "expire") return expireCredits(ledger, { amount: step.amount, key: `e${step.key}`, id: next(), at }).ledger;
    if (step.op === "refund") return refundForVersion(ledger, { hash: `h${step.hash}`, ids: next, at }).ledger;
    return spendCredits(ledger, { kind: step.kind, hash: `h${step.hash}`, price: step.price, id: next(), at }).ledger;
  }, EMPTY_LEDGER);
};

describe("properties of any sequence of operations", () => {
  it("the balance is the sum of the entries and is never negative", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 60 }), (steps) => {
        const ledger = run(steps);
        expect(balanceOf(ledger)).toBe(ledger.reduce((sum, e) => sum + e.amount, 0));
        expect(balanceOf(ledger)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("no spend is refunded twice, and a refund is never more than its spend", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 60 }), (steps) => {
        const ledger = run(steps);
        const refunds = ledger.filter((e) => e.kind === "refund");
        const targets = refunds.map((e) => e.refundOf);
        expect(new Set(targets).size).toBe(targets.length);
        for (const refund of refunds) {
          const spend = ledger.find((e) => e.id === refund.refundOf);
          expect(spend?.kind).toBe("spend");
          expect(refund.amount).toBe(-(spend?.amount ?? 0));
        }
      }),
    );
  });

  it("repeating a whole run of spends changes nothing", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 40 }), (steps) => {
        const spends = steps.filter((s) => s.op === "spend");
        const once = run([{ op: "grant", amount: 50, key: 0 }, ...spends]);
        const twice = run([{ op: "grant", amount: 50, key: 0 }, ...spends, ...spends]);
        expect(balanceOf(twice)).toBe(balanceOf(once));
      }),
    );
  });
});
