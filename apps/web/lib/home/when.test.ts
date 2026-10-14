import { describe, expect, it } from "vitest";
import { changedWhen } from "./when";

const NOW = new Date("2026-10-14T12:00:00.000Z");
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("changedWhen", () => {
  it("says just now for the last minute, and for a clock a little ahead", () => {
    expect(changedWhen(ago(20_000), NOW)).toBe("Just now");
    expect(changedWhen(ago(-30_000), NOW)).toBe("Just now");
  });

  it("counts minutes, then hours", () => {
    expect(changedWhen(ago(MINUTE), NOW)).toBe("1 minute ago");
    expect(changedWhen(ago(45 * MINUTE), NOW)).toBe("45 minutes ago");
    expect(changedWhen(ago(HOUR), NOW)).toBe("1 hour ago");
    expect(changedWhen(ago(23 * HOUR), NOW)).toBe("23 hours ago");
  });

  it("says yesterday for the day before, then counts days up to a week", () => {
    expect(changedWhen(ago(DAY + HOUR), NOW)).toBe("Yesterday");
    expect(changedWhen(ago(3 * DAY), NOW)).toBe("3 days ago");
    expect(changedWhen(ago(6 * DAY), NOW)).toBe("6 days ago");
  });

  it("gives the date for anything older than a week", () => {
    expect(changedWhen("2026-09-29T08:00:00.000Z", NOW)).toBe("29 Sep 2026");
  });

  it("says nothing for a date it cannot read", () => {
    expect(changedWhen("not a date", NOW)).toBe("");
  });
});
