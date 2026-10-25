import { describe, expect, it } from "vitest";
import { ROSTER_3, sampleOrder } from "../factory-sheet/fixtures";
import { buildPackingList, labelFor, sizeText, weightText } from "./model";
import type { Carton, PackBag } from "./rows";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const order = sampleOrder(1);
const bag = (n: number, over: Partial<PackBag> = {}): PackBag => ({ id: ID(n), orderId: order.id, bagNo: n, teamOrderId: ID(50), teamRowPosition: n, sizeLabel: "M", pieces: 1, cartonNo: null, packedAt: null, ...over });
const carton = (n: number, over: Partial<Carton> = {}): Carton => ({ id: ID(60 + n), orderId: order.id, cartonNo: n, weightG: null, lengthMm: null, widthMm: null, heightMm: null, ...over });

describe("weightText and sizeText", () => {
  it("say not set for what nobody typed, and never turn nothing into a number", () => {
    expect(weightText(null)).toBe("Not set");
    expect(weightText(4200)).toBe("4.2 kg");
    expect(weightText(5000)).toBe("5 kg");
    expect(weightText(450)).toBe("0.45 kg");
    expect(sizeText(carton(1))).toBe("Not set");
    expect(sizeText(carton(1, { lengthMm: 400, widthMm: 300, heightMm: null }))).toBe("400 × 300 × not set mm");
    expect(sizeText(carton(1, { lengthMm: 400, widthMm: 300, heightMm: 200 }))).toBe("400 × 300 × 200 mm");
  });
});

describe("labelFor", () => {
  it("puts the player's name and number from the team list on the label", () => {
    expect(labelFor(bag(1), 3, order, ROSTER_3)).toEqual(["OKAFOR", "Number 10", "Size M, 1 piece", `Order ${order.externalRef}`, "Bag 1 of 3"]);
  });
  it("says so when the list is gone, and does not guess a name", () => {
    expect(labelFor(bag(1), 3, order, null)[0]).toBe("Player not on the team list");
  });
  it("makes a plain bag's label from size and order only", () => {
    expect(labelFor(bag(1, { teamRowPosition: null, pieces: 4 }), 1, order, null)).toEqual(["Size M, 4 pieces", `Order ${order.externalRef}`, "Bag 1 of 1"]);
  });
  it("labels an empty name as no name", () => {
    expect(labelFor(bag(1), 1, order, [{ ...ROSTER_3[0]!, name: "" }])[0]).toBe("No name");
  });
});

describe("buildPackingList", () => {
  const bags = [bag(2, { sizeLabel: "M" }), bag(1), bag(3, { sizeLabel: "L", cartonNo: 1, packedAt: "2026-10-26T10:00:00.000Z" })];

  it("lists bags and cartons in number order whatever order they arrive in", () => {
    const a = buildPackingList({ order, brandName: "Northside", bags, cartons: [carton(2), carton(1)], roster: ROSTER_3 });
    const b = buildPackingList({ order, brandName: "Northside", bags: [...bags].reverse(), cartons: [carton(1), carton(2)], roster: ROSTER_3 });
    expect(a).toEqual(b);
    expect(a.bags.map((x) => x.no)).toEqual(["1", "2", "3"]);
    expect(a.summary).toBe("3 bags, 3 pieces, 2 cartons");
    expect(a.bags[2]).toMatchObject({ carton: "Carton 1" });
    expect(a.cartons[0]).toMatchObject({ no: "1", bags: "1", weight: "Not set", size: "Not set" });
  });

  it("warns about unset cartons, unpacked bags and a piece count that does not match", () => {
    const m = buildPackingList({ order: { ...order, pieces: 9 }, brandName: "Northside", bags, cartons: [carton(1)], roster: ROSTER_3 });
    expect(m.warnings).toEqual(expect.arrayContaining([
      "The bags hold 3 pieces and the order says 9. Ask before closing a carton.",
      "Carton 1: weight or size is not set. Weigh and measure it, then enter them.",
      "2 of 3 bags are not packed yet.",
    ]));
  });

  it("warns when the team list is gone, and when there are no bags", () => {
    expect(buildPackingList({ order, brandName: "N", bags, cartons: [], roster: null }).warnings.join(" ")).toMatch(/team list is gone/);
    expect(buildPackingList({ order, brandName: "N", bags: [], cartons: [], roster: null }).warnings).toEqual(["No bags have been made for this order yet."]);
  });

  it("is quiet when every carton is measured and every bag packed", () => {
    const done = [bag(1, { cartonNo: 1, packedAt: "2026-10-26T10:00:00.000Z" }), bag(2, { cartonNo: 1, packedAt: "2026-10-26T10:00:00.000Z" }), bag(3, { cartonNo: 1, packedAt: "2026-10-26T10:00:00.000Z" })];
    expect(buildPackingList({ order, brandName: "N", bags: done, cartons: [carton(1, { weightG: 4200, lengthMm: 400, widthMm: 300, heightMm: 200 })], roster: ROSTER_3 }).warnings).toEqual([]);
  });
});
