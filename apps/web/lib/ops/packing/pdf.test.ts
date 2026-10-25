import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { ROSTER_3, sampleOrder } from "../factory-sheet/fixtures";
import { buildPackingList } from "./model";
import { packingListPdf } from "./pdf";
import type { Carton, PackBag } from "./rows";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const order = sampleOrder(1);
const bags: PackBag[] = [1, 2, 3].map((n) => ({ id: ID(n), orderId: order.id, bagNo: n, teamOrderId: ID(50), teamRowPosition: n, sizeLabel: n === 3 ? "L" : "M", pieces: 1, cartonNo: n === 1 ? 1 : null, packedAt: n === 1 ? "2026-10-26T10:00:00.000Z" : null }));
const cartons: Carton[] = [{ id: ID(60), orderId: order.id, cartonNo: 1, weightG: 4200, lengthMm: 400, widthMm: 300, heightMm: null }];
const SAMPLE = buildPackingList({ order, brandName: "Northside Cricket Club", bags, cartons, roster: ROSTER_3 });

/** The SHA-256 of the sample packing list. Changes only when its content or layout changes on purpose: update it with the change and say why in the commit. */
const SAMPLE_PACKING_SHA256 = "793dc8ea71063f37f11857de24d70e2e1685ed2890dda201980ccb21a12a4edd";

describe("packingListPdf", () => {
  it("reads back with the labels, the cartons and what is not set", async () => {
    const facts = await readPdf(await packingListPdf(SAMPLE));
    expect(facts.startsAsPdf).toBe(true);
    for (const expected of ["Packing list: STORE-1001", "Northside Cricket Club", "OKAFOR", "Number 10", "Bag 2 of 3", "4.2 kg", "400 × 300 × not set mm", "Not packed", "Carton 1"]) {
      expect(facts.text, expected).toContain(expected);
    }
  }, 30_000);

  it("gives the same bytes twice, and the sample's recorded hash", async () => {
    const [a, b] = [await packingListPdf(SAMPLE), await packingListPdf(SAMPLE)];
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(createHash("sha256").update(a).digest("hex")).toBe(SAMPLE_PACKING_SHA256);
  }, 30_000);

  it("says plainly when nothing is set up", async () => {
    const facts = await readPdf(await packingListPdf(buildPackingList({ order, brandName: "N", bags: [], cartons: [], roster: null })));
    expect(facts.text).toContain("No carton has been set up.");
    expect(facts.text).toContain("No bags have been made for this order yet.");
  }, 30_000);
});
