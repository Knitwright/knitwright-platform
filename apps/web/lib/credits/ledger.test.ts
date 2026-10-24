import { describe, expect, it } from "vitest";
import { balanceOf, describeEntry, withRunningBalance, type LedgerEntry } from "./ledger";

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: "e1",
  kind: "grant",
  amount: 10,
  outputKind: null,
  designVersionHash: null,
  refundOf: null,
  idempotencyKey: "k",
  note: "",
  createdAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

describe("balanceOf", () => {
  it("is zero for an empty ledger", () => {
    expect(balanceOf([])).toBe(0);
  });

  it("adds grants and refunds and takes away spends and expiries", () => {
    const ledger = [
      entry({ id: "a", kind: "grant", amount: 10 }),
      entry({ id: "b", kind: "spend", amount: -3, outputKind: "techpack_pdf" }),
      entry({ id: "c", kind: "refund", amount: 3, refundOf: "b" }),
      entry({ id: "d", kind: "expire", amount: -2 }),
    ];
    expect(balanceOf(ledger)).toBe(8);
  });
});

describe("withRunningBalance", () => {
  it("lists newest first with the balance after each entry, without changing the input", () => {
    const ledger = [
      entry({ id: "a", kind: "grant", amount: 10, createdAt: "2026-10-01T00:00:00.000Z" }),
      entry({ id: "b", kind: "spend", amount: -4, createdAt: "2026-10-02T00:00:00.000Z" }),
    ];
    const frozen = JSON.stringify(ledger);
    const rows = withRunningBalance(ledger);
    expect(rows.map((r) => [r.id, r.balanceAfter])).toEqual([
      ["b", 6],
      ["a", 10],
    ]);
    expect(JSON.stringify(ledger)).toBe(frozen);
  });

  it("starts from the opening balance when only the latest lines are shown", () => {
    const rows = withRunningBalance([entry({ id: "a", kind: "spend", amount: -2 })], 7);
    expect(rows.map((r) => r.balanceAfter)).toEqual([5]);
  });

  it("orders entries made at the same moment by the order given", () => {
    const at = "2026-10-01T00:00:00.000Z";
    const rows = withRunningBalance([
      entry({ id: "a", amount: 5, createdAt: at }),
      entry({ id: "b", kind: "spend", amount: -5, createdAt: at }),
    ]);
    expect(rows.map((r) => r.balanceAfter)).toEqual([0, 5]);
  });
});

describe("describeEntry", () => {
  it("uses plain words for each kind", () => {
    expect(describeEntry(entry({ kind: "grant", note: "" }))).toMatch(/credits added/i);
    expect(describeEntry(entry({ kind: "spend", amount: -1, outputKind: "pattern_file" }))).toMatch(/pattern file/i);
    expect(describeEntry(entry({ kind: "refund", amount: 1 }))).toMatch(/given back/i);
    expect(describeEntry(entry({ kind: "expire", amount: -1 }))).toMatch(/ran out/i);
  });

  it("never uses the words the wording rules forbid", () => {
    const forbidden = /\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i;
    for (const kind of ["grant", "spend", "refund", "expire"] as const) {
      expect(describeEntry(entry({ kind, outputKind: "marketing_media" }))).not.toMatch(forbidden);
    }
  });
});
