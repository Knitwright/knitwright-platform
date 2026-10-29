import { describe, expect, it } from "vitest";
import { describeMissing, nextCutoff, promisedDate, startOf, type CutoffSetting, type DateInputs } from "./dates";

/**
 * The promised date (spec F-S7 acceptance: "the delivery date shown equals cut-off + factory lead time + QC +
 * freight from current factory profile data"). The Monday 12:00 cut-off is read on the factory's clock, which
 * in Sialkot is UTC+5 all year.
 */

const MONDAY_NOON: CutoffSetting = { weekday: 1, minutes: 12 * 60 };
const KARACHI = "Asia/Karachi";

const inputs = (over: Partial<DateInputs> = {}): DateInputs => ({
  orderAt: new Date("2027-03-03T00:00:00Z"),
  productionClass: "A",
  timeZone: KARACHI,
  cutoff: MONDAY_NOON,
  leadTimeDays: 8,
  qcDays: 2,
  freightDays: 4,
  ...over,
});

describe("nextCutoff", () => {
  it("finds the coming Monday noon in Sialkot, which is 07:00 UTC", () => {
    // Wednesday 3 March 2027.
    expect(nextCutoff(new Date("2027-03-03T00:00:00Z"), MONDAY_NOON, KARACHI).toISOString()).toBe("2027-03-08T07:00:00.000Z");
  });

  it("puts an order made exactly at the cut-off in that batch, and one a second later in the next", () => {
    expect(nextCutoff(new Date("2027-03-08T07:00:00Z"), MONDAY_NOON, KARACHI).toISOString()).toBe("2027-03-08T07:00:00.000Z");
    expect(nextCutoff(new Date("2027-03-08T07:00:01Z"), MONDAY_NOON, KARACHI).toISOString()).toBe("2027-03-15T07:00:00.000Z");
  });

  it("reads the cut-off on the factory's clock, not the customer's", () => {
    // 20:30 UTC on Sunday is already Monday 01:30 in Sialkot, so the cut-off is that same morning.
    expect(nextCutoff(new Date("2027-03-07T20:30:00Z"), MONDAY_NOON, KARACHI).toISOString()).toBe("2027-03-08T07:00:00.000Z");
  });

  it("keeps the same wall time through a summer-time change in a zone that has one", () => {
    const before = nextCutoff(new Date("2027-03-22T00:00:00Z"), MONDAY_NOON, "Europe/London");
    const after = nextCutoff(new Date("2027-03-30T00:00:00Z"), MONDAY_NOON, "Europe/London");
    expect(before.toISOString()).toBe("2027-03-22T12:00:00.000Z");
    expect(after.toISOString()).toBe("2027-04-05T11:00:00.000Z");
  });
});

describe("startOf", () => {
  it("starts Class A at the cut-off and Class B when the order is confirmed", () => {
    expect(startOf(inputs()).toISOString()).toBe("2027-03-08T07:00:00.000Z");
    expect(startOf(inputs({ productionClass: "B" })).toISOString()).toBe("2027-03-03T00:00:00.000Z");
  });
});

describe("promisedDate", () => {
  it("adds the lead time and QC in working days and the freight in calendar days", () => {
    // Cut-off Monday 8 March; 8 working days to Thursday the 18th; 2 more to Monday the 22nd; 4 freight days.
    expect(promisedDate(inputs())).toMatchObject({
      status: "set",
      readyForQcOn: "2027-03-18",
      shipsOn: "2027-03-22",
      promisedOn: "2027-03-26",
    });
  });

  it("gives a Class B order a date counted from the confirmation, not the cut-off", () => {
    expect(promisedDate(inputs({ productionClass: "B", leadTimeDays: 20, qcDays: 2, freightDays: 4 }))).toMatchObject({
      status: "set",
      // Wednesday 3 March plus 20 working days is Wednesday 31 March.
      readyForQcOn: "2027-03-31",
      shipsOn: "2027-04-02",
      promisedOn: "2027-04-06",
    });
  });

  it("promises nothing while a part is missing, and names every missing part", () => {
    const none = promisedDate(inputs({ leadTimeDays: null, qcDays: null, freightDays: null }));
    expect(none.status).toBe("not-set");
    expect(none.status === "not-set" && none.missing).toEqual(["the factory's lead time", "the days for QC", "the freight days"]);
    expect(none.startsAt.toISOString()).toBe("2027-03-08T07:00:00.000Z");
  });

  it("promises nothing when only the QC days are missing", () => {
    const one = promisedDate(inputs({ qcDays: null }));
    expect(one.status === "not-set" && one.missing).toEqual(["the days for QC"]);
  });

  it("counts a zero as set, not as missing", () => {
    expect(promisedDate(inputs({ qcDays: 0, freightDays: 0 }))).toMatchObject({ status: "set", readyForQcOn: "2027-03-18", shipsOn: "2027-03-18", promisedOn: "2027-03-18" });
  });

  it("gives the same answer in a zone with summer time, read on the factory's clock", () => {
    const sydney = promisedDate(inputs({ timeZone: "Australia/Sydney", orderAt: new Date("2027-04-01T00:00:00Z") }));
    expect(sydney).toMatchObject({ status: "set", readyForQcOn: "2027-04-15" });
  });
});

describe("describeMissing", () => {
  it("writes one, two and three missing parts as a sentence, and nothing for none", () => {
    expect(describeMissing([])).toBe("");
    expect(describeMissing(["the days for QC"])).toBe("Not set: the days for QC.");
    expect(describeMissing(["a", "b"])).toBe("Not set: a and b.");
    expect(describeMissing(["a", "b", "c"])).toBe("Not set: a, b and c.");
  });
});
