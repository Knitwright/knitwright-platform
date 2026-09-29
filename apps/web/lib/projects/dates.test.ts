import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, isoDay } from "./dates";

describe("formatDate", () => {
  it("writes the day, the month by name and the year", () => {
    expect(formatDate("2026-09-29T14:05:00.000Z")).toBe("29 Sep 2026");
  });

  it("does not move the day by the time zone of the machine", () => {
    expect(formatDate("2026-09-29T23:59:00+00:00")).toBe("29 Sep 2026");
  });

  it("says nothing for a date it cannot read", () => {
    expect(formatDate("not a date")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("adds the time on a 24 hour clock and says it is UTC", () => {
    expect(formatDateTime("2026-09-29T14:05:00.000Z")).toBe("29 Sep 2026, 14:05 UTC");
  });

  it("says nothing for a date it cannot read", () => {
    expect(formatDateTime("")).toBe("");
  });
});

describe("isoDay", () => {
  it("writes the day as year, month and day, in UTC", () => {
    expect(isoDay("2026-09-29T23:59:00+00:00")).toBe("2026-09-29");
    expect(isoDay("2026-01-05T00:00:00Z")).toBe("2026-01-05");
  });

  it("says nothing for a date it cannot read", () => {
    expect(isoDay("not a date")).toBe("");
  });
});
