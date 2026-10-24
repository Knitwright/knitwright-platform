import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_OPS_SETTINGS, type OpsSettings } from "./settings";
import { nextCutoff, promisedOn } from "./cutoff";

// 2026-10-23 is a Friday.
const friday5pm: OpsSettings = { ...DEFAULT_OPS_SETTINGS, cutoffWeekday: 5, cutoffMinutes: 17 * 60 };
const at = (iso: string) => new Date(iso);

describe("nextCutoff", () => {
  it("takes an order made before the cut-off into this week's batch", () => {
    expect(nextCutoff(at("2026-10-21T09:00:00Z"), friday5pm).toISOString()).toBe("2026-10-23T17:00:00.000Z");
  });

  it("takes an order made exactly at the cut-off into that batch", () => {
    expect(nextCutoff(at("2026-10-23T17:00:00Z"), friday5pm).toISOString()).toBe("2026-10-23T17:00:00.000Z");
  });

  it("moves an order made after the cut-off to next week", () => {
    expect(nextCutoff(at("2026-10-23T17:00:01Z"), friday5pm).toISOString()).toBe("2026-10-30T17:00:00.000Z");
    expect(nextCutoff(at("2026-10-24T10:00:00Z"), friday5pm).toISOString()).toBe("2026-10-30T17:00:00.000Z");
  });

  it("crosses a month and a year", () => {
    expect(nextCutoff(at("2026-12-31T00:00:00Z"), friday5pm).toISOString()).toBe("2027-01-01T17:00:00.000Z");
  });

  it("always lands on the set weekday and time, within the coming seven days", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("2020-01-01"), max: new Date("2040-01-01"), noInvalidDate: true }), fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 1439 }), (when, weekday, minutes) => {
        const cut = nextCutoff(when, { ...DEFAULT_OPS_SETTINGS, cutoffWeekday: weekday, cutoffMinutes: minutes });
        expect(cut.getUTCDay()).toBe(weekday);
        expect(cut.getUTCHours() * 60 + cut.getUTCMinutes()).toBe(minutes);
        expect(cut.getTime()).toBeGreaterThanOrEqual(when.getTime());
        expect(cut.getTime() - when.getTime()).toBeLessThan(7 * 86_400_000);
      }),
    );
  });
});

describe("promisedOn", () => {
  it("is not set while no lead time is set, and never guesses one", () => {
    expect(promisedOn(at("2026-10-23T17:00:00Z"), null)).toBeNull();
  });

  it("adds the lead time in days to the cut-off date", () => {
    expect(promisedOn(at("2026-10-23T17:00:00Z"), 21)).toBe("2026-11-13");
    expect(promisedOn(at("2026-10-23T17:00:00Z"), 0)).toBe("2026-10-23");
  });
});

describe("the defaults", () => {
  it("are labelled as Knitwright's and carry no lead time", () => {
    expect(DEFAULT_OPS_SETTINGS.leadTimeDays).toBeNull();
    expect(DEFAULT_OPS_SETTINGS.label).toMatch(/not agreed with a factory/);
  });
});
