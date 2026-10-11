import { describe, expect, it } from "vitest";
import { HOT_SCORE, LEAD_POINTS, isHot, leadScore, type ScoreInput } from "./score";

const NOW = new Date("2026-10-11T09:00:00Z");

const nothing: ScoreInput = {
  organisationType: null,
  country: null,
  quotes: [],
  mostVersions: 0,
  sharedWithOthers: false,
  paidCreditsOrSample: false,
};

const quote = (quantity: number, neededBy: string) => ({ quantity, neededBy });

describe("leadScore", () => {
  it("gives nothing to a brand that has told us nothing", () => {
    expect(leadScore(nothing, NOW)).toEqual({ total: 0, reasons: [] });
  });

  it("gives points for an organisation type", () => {
    const score = leadScore({ ...nothing, organisationType: "club" }, NOW);

    expect(score.total).toBe(LEAD_POINTS.organisation);
    expect(score.reasons).toEqual(["Organisation and type given"]);
  });

  it("counts the highest quantity once: 200 or more beats 50 or more", () => {
    expect(leadScore({ ...nothing, quotes: [quote(49, "2027-06-01")] }, NOW).total).toBe(0);
    expect(leadScore({ ...nothing, quotes: [quote(50, "2027-06-01")] }, NOW).total).toBe(LEAD_POINTS.quantity50);
    expect(leadScore({ ...nothing, quotes: [quote(200, "2027-06-01")] }, NOW).total).toBe(LEAD_POINTS.quantity200);
    expect(
      leadScore({ ...nothing, quotes: [quote(60, "2027-06-01"), quote(250, "2027-06-01")] }, NOW).reasons,
    ).toContain("Quantity 200 or more");
  });

  it("gives points for a needed-by date within 12 weeks, and none for a later or past one", () => {
    const within = leadScore({ ...nothing, quotes: [quote(1, "2027-01-03")] }, NOW);
    const later = leadScore({ ...nothing, quotes: [quote(1, "2027-01-04")] }, NOW);
    const past = leadScore({ ...nothing, quotes: [quote(1, "2026-10-01")] }, NOW);

    expect(within.total).toBe(LEAD_POINTS.neededSoon);
    expect(later.total).toBe(0);
    expect(past.total).toBe(0);
  });

  it("gives points when a design was edited 3 or more times", () => {
    expect(leadScore({ ...nothing, mostVersions: 3 }, NOW).total).toBe(0);
    expect(leadScore({ ...nothing, mostVersions: 4 }, NOW).total).toBe(LEAD_POINTS.engaged);
  });

  it("gives the same points for sharing, once sharing exists, and not twice", () => {
    expect(leadScore({ ...nothing, sharedWithOthers: true }, NOW).total).toBe(LEAD_POINTS.engaged);
    expect(leadScore({ ...nothing, sharedWithOthers: true, mostVersions: 9 }, NOW).total).toBe(LEAD_POINTS.engaged);
  });

  it("gives points for two quote requests or more", () => {
    const two = [quote(1, "2027-06-01"), quote(1, "2027-06-01")];

    expect(leadScore({ ...nothing, quotes: two.slice(0, 1) }, NOW).total).toBe(0);
    expect(leadScore({ ...nothing, quotes: two }, NOW).total).toBe(LEAD_POINTS.quotedTwice);
  });

  it("gives points for paid credits or a sample, once they exist", () => {
    expect(leadScore({ ...nothing, paidCreditsOrSample: true }, NOW).total).toBe(LEAD_POINTS.paid);
  });

  it("gives points for Australia", () => {
    expect(leadScore({ ...nothing, country: "AU" }, NOW).total).toBe(LEAD_POINTS.australia);
    expect(leadScore({ ...nothing, country: "NZ" }, NOW).total).toBe(0);
  });

  it("adds every part up for a hot Australian club", () => {
    const score = leadScore(
      {
        ...nothing,
        organisationType: "club",
        country: "AU",
        quotes: [quote(120, "2026-11-20"), quote(80, "2026-12-01")],
        mostVersions: 6,
      },
      NOW,
    );

    expect(score.total).toBe(10 + 20 + 25 + 15 + 10 + 10);
    expect(isHot(score.total)).toBe(true);
  });
});

describe("isHot", () => {
  it("is true from 60", () => {
    expect(HOT_SCORE).toBe(60);
    expect(isHot(59)).toBe(false);
    expect(isHot(60)).toBe(true);
  });
});
