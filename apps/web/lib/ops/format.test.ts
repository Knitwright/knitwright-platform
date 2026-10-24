import { describe, expect, it } from "vitest";
import { batchLabel, formatValue, orderValue, sizesLine, statusCounts } from "./format";

describe("ops formatting", () => {
  it("shows a value in its own currency, and says when none was given", () => {
    expect(formatValue({ minor: 125000, currency: "AUD" })).toMatch(/1,250\.00/);
    expect(formatValue(null)).toBe("Not given");
    expect(orderValue({ valueMinor: null, currency: null })).toBe("Not given");
    expect(orderValue({ valueMinor: 500, currency: "AUD" })).toMatch(/5\.00/);
  });

  it("falls back to the code and amount for a currency the platform cannot format", () => {
    expect(formatValue({ minor: 500, currency: "XX" })).toBe("XX 5.00");
  });

  it("writes sizes in size order", () => {
    expect(sizesLine({ XL: 1, M: 3, "2XL": 2 })).toBe("2XL ×2, M ×3, XL ×1");
  });

  it("labels a batch and counts statuses in words", () => {
    expect(batchLabel({ articleId: "team-jersey", fabricKey: "mesh", factoryProfileId: "f1", cutoffAt: "2026-10-23T17:00:00.000Z" })).toBe("team-jersey, mesh, f1, cut-off 2026-10-23");
    expect(statusCounts({ batched: 2, ready: 1 })).toBe("2 in a batch, 1 ready");
  });
});
