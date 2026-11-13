import type { Ladder } from "@/lib/factory/pricing";
import type { StorePurchase, TeamStore } from "../model";

/**
 * Made-up team stores for the unit tests and the /dev/team-stores fixture page (decision 0153). Every price is the
 * build pack's placeholder ladder shape, labelled as such; nothing here is a real club or a real person.
 */

const tier = (qtyMin: number, qtyMax: number | null, gbp: number | null) => ({
  id: `00000000-0000-4000-8000-0000000000${qtyMin}`,
  capabilityId: "00000000-0000-4000-8000-000000000099",
  qtyMin,
  qtyMax,
  cost: null,
  sellGbpMinor: gbp,
  sellAudMinor: null,
  personalisationCostMinor: null,
  ruleId: "R-COST-003",
  label: "Placeholder club price from the build pack, not a factory quote",
});

export const FIXTURE_LADDER: Ladder = [tier(10, 19, 2900), tier(20, 49, 2500), tier(50, null, 2200)];

export const NOW = new Date("2026-11-13T12:00:00.000Z");

export const fixtureStore = (over: Partial<TeamStore> = {}): TeamStore => ({
  id: "00000000-0000-4000-8000-000000000a01",
  brandId: "00000000-0000-4000-8000-000000000b01",
  code: "Ab3dEf7hJk",
  title: "U16s home kit",
  projectId: "00000000-0000-4000-8000-000000000c01",
  productId: "00000000-0000-4000-8000-000000000d01",
  releaseId: "00000000-0000-4000-8000-000000000e01",
  factoryProfileId: "knitwright-default",
  fabricKey: "mesh-140",
  flags: [],
  currency: "GBP",
  unitMinor: 2900,
  priceLabel: "Priced at the 10-piece tier, the store's minimum.",
  marginBps: 1000,
  marginMinor: 290,
  sizes: ["S", "M", "L", "XL"],
  namesNumbers: true,
  nameMax: 12,
  numberMin: 0,
  numberMax: 99,
  minPieces: 10,
  seasonId: null,
  opensAt: "2026-11-10T00:00:00.000Z",
  closesAt: "2026-11-20T23:59:59.000Z",
  status: "open",
  piecesSold: null,
  closeSizes: null,
  closeRequestKey: null,
  orderId: null,
  closeMessage: null,
  marginOwedMinor: null,
  closedAt: null,
  createdBy: "00000000-0000-4000-8000-000000000f01",
  ...over,
});

let counter = 0;

export const fixturePurchase = (over: Partial<StorePurchase> = {}): StorePurchase => {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    paymentId: `00000000-0000-4000-9000-${String(counter).padStart(12, "0")}`,
    buyerName: "Sam Parent",
    buyerEmail: "sam@example.test",
    pieces: 1,
    amountMinor: 3190,
    counted: true,
    paymentStatus: "fulfilled",
    lines: [{ sizeLabel: "M", printName: "KHAN", printNumber: "10" }],
    ...over,
  };
};
