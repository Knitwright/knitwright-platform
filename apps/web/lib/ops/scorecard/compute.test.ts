import { describe, expect, it } from "vitest";
import type { OpsException } from "../exceptions/rows";
import type { OpsOrder } from "../rows";
import type { Shipment } from "../shipping/rows";
import {
  buildScorecards,
  NO_DEFECT_RATE_AGREED,
  NOT_ACTIVE_WITHOUT_GOLDEN_SAMPLE,
  percent,
  type ScorecardInput,
} from "./compute";

const NOW = new Date("2026-12-07T10:00:00Z");
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const order = (n: number, over: Partial<OpsOrder> = {}): OpsOrder => ({
  id: ID(n),
  releaseId: ID(900),
  brandId: ID(901),
  projectId: ID(902),
  externalRef: `KW-${n}`,
  factoryProfileId: "sialkot-partner",
  fabricKey: `fabric-${n}`,
  articleId: "football-shirt",
  sizes: { M: 10 },
  pieces: 10,
  valueMinor: null,
  currency: null,
  release: { label: "R1", number: 1, rosterHash: null },
  status: "ready",
  batchId: ID(800),
  cutoffAt: "2026-12-01T12:00:00.000Z",
  leadTimeDays: null,
  promisedOn: "2026-12-05",
  createdAt: "2026-12-01T10:00:00.000Z",
  ...over,
});

const ship = (n: number, orderId: string, shippedOn: string): Shipment => ({
  id: ID(500 + n),
  orderId,
  provider: "manual",
  courier: "DHL",
  trackingNumber: "T",
  shippedOn,
  sizes: { M: 10 },
  pieces: 10,
  note: "",
  courierCode: null,
  trackingUrl: null,
  at: `${shippedOn}T09:00:00.000Z`,
});

const remake = (n: number, orderId: string, over: Partial<OpsException> = {}): OpsException => ({
  id: ID(600 + n),
  orderId,
  kind: "remake",
  status: "open",
  owner: "Sam",
  dueOn: "2027-01-01",
  detail: {},
  note: "",
  resolution: null,
  resolvedOn: null,
  createdAt: "2026-12-02T10:00:00.000Z",
  ...over,
});

const input = (over: Partial<ScorecardInput> = {}): ScorecardInput => ({
  now: NOW,
  orders: [],
  shipments: [],
  inspections: [],
  readings: [],
  exceptions: [],
  goldenSamples: [],
  factories: [{ slug: "sialkot-partner", name: "Sialkot partner" }],
  ...over,
});

const only = (over: Partial<ScorecardInput> = {}) => buildScorecards(input(over))[0]!;

describe("buildScorecards", () => {
  it("gives a factory with no order yet a card, with nothing counted rather than a perfect score", () => {
    const card = only();
    expect([card.orders, card.onTime.rate, card.defects.rate, card.colour.rate]).toEqual([0, null, null, null]);
    expect(card.isActive).toBe(false);
  });

  it("counts on-time against the date promised, and keeps orders with no date apart", () => {
    const card = only({
      orders: [order(1), order(2), order(3, { promisedOn: null })],
      shipments: [ship(1, ID(1), "2026-12-04"), ship(2, ID(2), "2026-12-06"), ship(3, ID(3), "2026-12-06")],
    });
    expect(card.onTime).toEqual({ onTime: 1, late: 1, withoutPromise: 1, rate: 0.5 });
  });

  it("counts nothing from an order that is not fully shipped", () => {
    const card = only({ orders: [order(1)], shipments: [{ ...ship(1, ID(1), "2026-12-04"), pieces: 4, sizes: { M: 4 } }] });
    expect(card.onTime.rate).toBeNull();
  });

  it("counts the defect rate and never says whether it is acceptable", () => {
    const card = only({ inspections: [{ factoryProfileId: "sialkot-partner", result: "fail", sampleSize: 20, defectCount: 1 }] });
    expect(card.defects).toEqual({ inspections: 1, sampled: 20, defective: 1, rate: 0.05 });
    expect(card.warnings.join(" ")).toContain(NO_DEFECT_RATE_AGREED);
  });

  it("counts the colour pass rate over the readings a tolerance judged, and keeps the rest apart", () => {
    const card = only({
      readings: [
        { factoryProfileId: "sialkot-partner", deltaE: 1.2, limitDeltaE: 1.5 },
        { factoryProfileId: "sialkot-partner", deltaE: 1.9, limitDeltaE: 1.5 },
        { factoryProfileId: "sialkot-partner", deltaE: 9, limitDeltaE: null },
      ],
    });
    expect(card.colour).toEqual({ readings: 3, judged: 2, inside: 1, rate: 0.5 });
    expect(card.warnings.join(" ")).toContain("1 colour readings are over the tolerance");
    expect(card.warnings.join(" ")).toContain("had no tolerance on file");
  });

  it("counts remakes of this factory's orders only, and says which are past their date", () => {
    const card = only({
      orders: [order(1)],
      exceptions: [remake(1, ID(1)), remake(2, ID(1), { dueOn: "2026-12-01" }), remake(3, ID(99))],
    });
    expect(card.remakes).toEqual({ open: 2, overdue: 1, total: 2 });
    expect(card.warnings.join(" ")).toContain("1 remake lines are past their due date");
  });

  it("is active only with a golden sample signed off, and lists the state per article", () => {
    const none = only({ goldenSamples: [{ factoryProfileId: "sialkot-partner", articleCode: "JSY-SS-01", state: "requested" }] });
    expect(none.isActive).toBe(false);
    expect(none.warnings).toContain(NOT_ACTIVE_WITHOUT_GOLDEN_SAMPLE);
    const active = only({
      goldenSamples: [
        { factoryProfileId: "sialkot-partner", articleCode: "JSY-SS-01", state: "approved" },
        { factoryProfileId: "sialkot-partner", articleCode: "SHO-TR-01", state: "none" },
      ],
    });
    expect(active.isActive).toBe(true);
    expect(active.warnings).not.toContain(NOT_ACTIVE_WITHOUT_GOLDEN_SAMPLE);
    expect(active.goldenSamples.map((g) => g.articleCode)).toEqual(["JSY-SS-01", "SHO-TR-01"]);
  });

  it("gives a card to a factory an order names that is not on file, under its own id", () => {
    const cards = buildScorecards(input({ factories: [], orders: [order(1, { factoryProfileId: "someone-else" })] }));
    expect(cards.map((c) => [c.factoryProfileId, c.name])).toEqual([["someone-else", "someone-else"]]);
  });

  it("orders the cards by name", () => {
    const cards = buildScorecards(
      input({
        factories: [
          { slug: "b", name: "Zed works" },
          { slug: "a", name: "Able works" },
        ],
      }),
    );
    expect(cards.map((c) => c.name)).toEqual(["Able works", "Zed works"]);
  });

  it("says nothing is wrong when nothing on file says so", () => {
    const card = only({
      orders: [order(1)],
      shipments: [ship(1, ID(1), "2026-12-04")],
      inspections: [{ factoryProfileId: "sialkot-partner", result: "pass", sampleSize: 20, defectCount: 0 }],
      readings: [{ factoryProfileId: "sialkot-partner", deltaE: 1.2, limitDeltaE: 1.5 }],
      goldenSamples: [{ factoryProfileId: "sialkot-partner", articleCode: "JSY-SS-01", state: "approved" }],
    });
    expect(card.warnings).toEqual([]);
  });
});

describe("percent", () => {
  it("rounds a rate, and says plainly when there is nothing to count", () => {
    expect([percent(0.825), percent(1), percent(0)]).toEqual(["83%", "100%", "0%"]);
    expect(percent(null)).toBe("Nothing counted yet");
  });
});
