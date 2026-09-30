import { describe, expect, it } from "vitest";
import { allowanceMonth, allowanceRefusal, nextAllowanceReset } from "./period";

describe("allowanceMonth", () => {
  it("is the first day of the calendar month in UTC", () => {
    expect(allowanceMonth(new Date("2026-09-30T12:00:00Z"))).toBe("2026-09-01");
    expect(allowanceMonth(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10-01");
  });

  it("follows UTC, not the local clock, at the turn of a month", () => {
    // 23:30 on 31 October in UTC is already 1 November in Asia, still October in UTC.
    expect(allowanceMonth(new Date("2026-10-31T23:30:00Z"))).toBe("2026-10-01");
    expect(allowanceMonth(new Date("2026-10-31T23:30:00-05:00"))).toBe("2026-11-01");
  });
});

describe("nextAllowanceReset", () => {
  it("is midnight UTC on the first day of the next month", () => {
    expect(nextAllowanceReset(new Date("2026-09-30T23:59:59Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(nextAllowanceReset(new Date("2026-10-01T00:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("rolls over the year", () => {
    expect(nextAllowanceReset(new Date("2026-12-15T08:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("allowanceRefusal", () => {
  const now = new Date("2026-09-30T10:00:00Z");

  it("tells a person their month's allowance is used and when it starts again", () => {
    expect(allowanceRefusal("user", now)).toBe(
      "You have used this month's allowance for this. It starts again on 1 October (UTC).",
    );
  });

  it("says so for the brand", () => {
    expect(allowanceRefusal("brand", now)).toBe(
      "Your brand has used this month's allowance for this. It starts again on 1 October (UTC).",
    );
  });

  it("never speaks of today", () => {
    for (const who of ["user", "brand"] as const) {
      expect(allowanceRefusal(who, new Date("2026-12-31T23:00:00Z"))).not.toMatch(/today|midnight/i);
    }
    expect(allowanceRefusal("user", new Date("2026-12-31T23:00:00Z"))).toMatch(/1 January/);
  });
});
