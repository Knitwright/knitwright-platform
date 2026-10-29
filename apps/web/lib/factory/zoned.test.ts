import { describe, expect, it } from "vitest";
import { addDays, addWorkingDays, isTimeZone, isoDate, offsetMs, wallDate, weekdayOf, zonedInstant } from "./zoned";

/**
 * Wall-clock arithmetic in a named time zone, with no library. Pakistan keeps one offset all year (UTC+5),
 * which is why the cut-off is set there; London and Sydney move, and the tests hold both ends of a change.
 */

const HOUR = 3_600_000;

describe("isTimeZone", () => {
  it("knows a real zone and refuses one it has never heard of", () => {
    expect(isTimeZone("Asia/Karachi")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("offsetMs", () => {
  it("gives Pakistan the same offset in January and July: it keeps no summer time", () => {
    expect(offsetMs(Date.UTC(2027, 0, 15), "Asia/Karachi")).toBe(5 * HOUR);
    expect(offsetMs(Date.UTC(2027, 6, 15), "Asia/Karachi")).toBe(5 * HOUR);
  });

  it("follows London and Sydney through their changes", () => {
    expect(offsetMs(Date.UTC(2027, 0, 15), "Europe/London")).toBe(0);
    expect(offsetMs(Date.UTC(2027, 6, 15), "Europe/London")).toBe(HOUR);
    expect(offsetMs(Date.UTC(2027, 0, 15), "Australia/Sydney")).toBe(11 * HOUR);
    expect(offsetMs(Date.UTC(2027, 6, 15), "Australia/Sydney")).toBe(10 * HOUR);
  });
});

describe("wallDate and weekdayOf", () => {
  it("reads the calendar date on the factory's clock, which can be the next day", () => {
    // 20:30 UTC on a Sunday is 01:30 on Monday in Sialkot.
    expect(wallDate(new Date("2027-03-07T20:30:00Z"), "Asia/Karachi")).toEqual({ year: 2027, month: 3, day: 8 });
    expect(weekdayOf(wallDate(new Date("2027-03-07T20:30:00Z"), "Asia/Karachi"))).toBe(1);
    expect(wallDate(new Date("2027-03-07T20:30:00Z"), "UTC")).toEqual({ year: 2027, month: 3, day: 7 });
  });
});

describe("addDays and isoDate", () => {
  it("crosses a month and a year end", () => {
    expect(isoDate(addDays({ year: 2027, month: 1, day: 30 }, 3))).toBe("2027-02-02");
    expect(isoDate(addDays({ year: 2027, month: 12, day: 30 }, 3))).toBe("2028-01-02");
    expect(isoDate(addDays({ year: 2028, month: 2, day: 28 }, 1))).toBe("2028-02-29");
  });
});

describe("addWorkingDays", () => {
  it("skips Saturday and Sunday", () => {
    // Friday 5 March 2027 plus one working day is Monday the 8th.
    expect(isoDate(addWorkingDays({ year: 2027, month: 3, day: 5 }, 1))).toBe("2027-03-08");
    expect(isoDate(addWorkingDays({ year: 2027, month: 3, day: 5 }, 5))).toBe("2027-03-12");
  });

  it("counts from the next Monday when it starts on a weekend, and adds nothing for zero days", () => {
    expect(isoDate(addWorkingDays({ year: 2027, month: 3, day: 6 }, 1))).toBe("2027-03-08");
    expect(isoDate(addWorkingDays({ year: 2027, month: 3, day: 6 }, 0))).toBe("2027-03-06");
  });
});

describe("zonedInstant", () => {
  it("turns a wall time in Sialkot into the right instant: 12:00 PKT is 07:00 UTC", () => {
    expect(zonedInstant({ year: 2027, month: 3, day: 8 }, 12 * 60, "Asia/Karachi").toISOString()).toBe("2027-03-08T07:00:00.000Z");
  });

  it("holds a London noon on both sides of the spring change", () => {
    expect(zonedInstant({ year: 2027, month: 3, day: 27 }, 12 * 60, "Europe/London").toISOString()).toBe("2027-03-27T12:00:00.000Z");
    expect(zonedInstant({ year: 2027, month: 3, day: 29 }, 12 * 60, "Europe/London").toISOString()).toBe("2027-03-29T11:00:00.000Z");
  });

  it("takes the earlier instant when a wall time happens twice (the autumn overlap)", () => {
    // 01:30 on 31 October 2027 exists twice in London: once at 00:30 UTC (BST) and once at 01:30 UTC (GMT).
    expect(zonedInstant({ year: 2027, month: 10, day: 31 }, 90, "Europe/London").toISOString()).toBe("2027-10-31T00:30:00.000Z");
  });

  it("lands just after the gap when a wall time does not exist (the spring jump)", () => {
    // 01:30 on 28 March 2027 never happens in London: the clock goes 01:00 to 02:00.
    expect(zonedInstant({ year: 2027, month: 3, day: 28 }, 90, "Europe/London").toISOString()).toBe("2027-03-28T01:30:00.000Z");
  });
});
