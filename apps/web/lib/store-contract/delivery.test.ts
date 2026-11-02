import { describe, expect, it } from "vitest";
import { hasNoDate, storeDelivery } from "./delivery";
import { deliveryComplete, deliveryToday } from "./fixtures/samples";

/**
 * Delivery. Today the platform can promise nothing, and the test that matters is that the payload
 * carries no date field of any kind when that is so.
 */

describe("delivery as the platform really holds it today", () => {
  it("is a gap, naming the days for QC and the freight days", () => {
    const delivery = storeDelivery(deliveryToday);
    if (delivery.promised.status !== "gap") throw new Error("gap");

    expect(delivery.promised.missing).toEqual(["the days for QC", "the freight days"]);
    expect(hasNoDate(delivery)).toBe(true);
  });

  it("carries no date field at all, so nothing can be read as today", () => {
    const { promised } = storeDelivery(deliveryToday);

    expect(Object.keys(promised)).toEqual(["status", "missing", "because", "ruleId"]);
    expect(JSON.stringify(promised)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("uses the platform's own words for what is missing, so one sentence is shown everywhere", () => {
    const { promised } = storeDelivery(deliveryToday);
    if (promised.status !== "gap") throw new Error("gap");

    expect(promised.because).toContain("Not set: the days for QC and the freight days.");
    expect(promised.because).toContain("names what is missing instead of showing one");
  });

  it("still gives the cut-off production would start at, which is a fact and not a promise", () => {
    const delivery = storeDelivery(deliveryToday);

    expect(delivery.productionStartsAt).toBe("2027-01-11T07:00:00.000Z");
  });

  it("is a gap for the lead time too, where the factory has agreed none", () => {
    const { promised } = storeDelivery({ ...deliveryToday, leadTimeDays: null });
    if (promised.status !== "gap") throw new Error("gap");

    expect(promised.missing).toContain("the factory's lead time");
  });
});

describe("delivery once every figure is on file", () => {
  it("gives the three dates, and nothing is a gap", () => {
    const delivery = storeDelivery(deliveryComplete);
    if (delivery.promised.status !== "held") throw new Error("held");

    expect(delivery.promised.readyForQcOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(delivery.promised.shipsOn >= delivery.promised.readyForQcOn).toBe(true);
    expect(delivery.promised.promisedOn > delivery.promised.shipsOn).toBe(true);
    expect(hasNoDate(delivery)).toBe(false);
  });

  it("starts a Class B order counting from the order itself rather than a cut-off", () => {
    const delivery = storeDelivery({ ...deliveryComplete, productionClass: "B" });

    expect(delivery.productionStartsAt).toBe(deliveryComplete.orderAt.toISOString());
  });
});
