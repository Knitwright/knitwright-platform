import { describe, expect, it } from "vitest";
import type { PromisedDate } from "@/lib/factory/dates";
import { deliveryLine, PLACEHOLDER_NOTE, readyBy } from "./delivery";

const startsAt = new Date("2026-11-02T07:00:00.000Z");
const set: PromisedDate = { status: "set", startsAt, readyForQcOn: "2026-11-12", shipsOn: "2026-11-14", promisedOn: "2026-11-21" };
const notSet: PromisedDate = { status: "not-set", startsAt, missing: ["the days for QC", "the freight days"] };

describe("the delivery date", () => {
  it("shows the date the factory data gives, and where it came from", () => {
    const line = deliveryLine({ date: set, placeholder: false });
    expect(line).toMatchObject({ status: "set", promisedOn: "2026-11-21", note: "" });
    expect(line.text).toContain("the next cut-off");
    expect(readyBy(line)).toBe("2026-11-21");
  });

  it("promises nothing while a part of the sum is not set, and names the missing parts", () => {
    const line = deliveryLine({ date: notSet, placeholder: true });
    expect(line.status).toBe("not-set");
    expect(line.promisedOn).toBeNull();
    expect(readyBy(line)).toBeNull();
    expect(line.text).toContain("the days for QC and the freight days");
    expect(line.text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("says when the parts that are set are still Knitwright's placeholders", () => {
    expect(deliveryLine({ date: set, placeholder: true }).note).toBe(PLACEHOLDER_NOTE);
    expect(deliveryLine({ date: notSet, placeholder: false }).note).toBe("");
  });
});
