import { describe, expect, it } from "vitest";
import { ROSTER_3, SAMPLE_SHEET_INPUT, sampleOrder } from "./fixtures";
import { buildSheet, NOT_SET } from "./model";

describe("buildSheet", () => {
  const sheet = buildSheet(SAMPLE_SHEET_INPUT);

  it("lists the orders by reference with their brand, release and pieces", () => {
    expect(sheet.orders.map((o) => o.ref)).toEqual(["STORE-1001", "STORE-1002"]);
    expect(sheet.orders[0]).toEqual({ ref: "STORE-1001", brand: "Northside Cricket Club", release: "Round 1 (release 1)", pieces: 3, promised: NOT_SET });
  });

  it("breaks pieces down by size, in size order, with totals", () => {
    expect(sheet.sizes).toEqual(["L", "M", "XL"]);
    expect(sheet.breakdown).toEqual([
      { ref: "STORE-1001", counts: [1, 2, 0], total: 3 },
      { ref: "STORE-1002", counts: [0, 2, 4], total: 6 },
    ]);
    expect(sheet.totals).toEqual({ counts: [1, 4, 4], total: 9 });
  });

  it("promises no due date while no lead time is set, and says why", () => {
    expect(sheet.dueDate).toBe(NOT_SET);
    expect(sheet.dueNote).toMatch(/No lead time has been set/);
  });

  it("takes the earliest promised date as the due date", () => {
    const input = { ...SAMPLE_SHEET_INPUT, orders: [{ ...SAMPLE_SHEET_INPUT.orders[0]!, order: sampleOrder(2, { promisedOn: "2026-11-20" }) }, { ...SAMPLE_SHEET_INPUT.orders[1]!, order: sampleOrder(1, { promisedOn: "2026-11-13" }) }] };
    const s = buildSheet(input);
    expect(s.dueDate).toBe("2026-11-13");
    expect(s.dueNote).toBeNull();
  });

  it("sorts the name and number list by number, and says plainly when an order has none", () => {
    expect(sheet.names[0]?.rows.map((r) => r.number)).toEqual(["7", "10", "22"]);
    expect(sheet.names[1]).toMatchObject({ rows: [], notice: expect.stringMatching(/No name and number list/) });
  });

  it("warns when a team list and the order disagree on pieces", () => {
    const bad = buildSheet({ ...SAMPLE_SHEET_INPUT, orders: [{ order: sampleOrder(1, { pieces: 5, sizes: { M: 5 } }), brandName: "B", roster: ROSTER_3 }] });
    expect(bad.warnings).toEqual(["STORE-1001: the name and number list has 3 pieces and the order says 5. Ask before cutting."]);
    expect(sheet.warnings).toEqual([]);
  });

  it("labels the fabric quantity, trims, packing and cut-off as not set or as defaults, never as measured", () => {
    expect(sheet.bom.every((b) => /^Not set/.test(b.quantity))).toBe(true);
    expect(sheet.packingLabel).toMatch(/Knitwright default, not agreed with a factory/);
    expect(sheet.cutoffLine).toMatch(/Knitwright default, not agreed with a factory/);
  });

  it("is the same whatever order the orders come in, and does not change its input", () => {
    const reversed = { ...SAMPLE_SHEET_INPUT, orders: [...SAMPLE_SHEET_INPUT.orders].reverse() };
    expect(buildSheet(reversed)).toEqual(sheet);
    expect(SAMPLE_SHEET_INPUT.orders[0]?.order.externalRef).toBe("STORE-1002");
  });
});
