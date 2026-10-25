import { describe, expect, it } from "vitest";
import * as copy from "./copy";

const FORBIDDEN = /\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i;

describe("the designer wording", () => {
  it("never says a design is checked, approved or the like", () => {
    const texts = [
      ...Object.values(copy.STATUS_LABELS),
      ...Object.values(copy.PAYOUT_LABELS),
      copy.RIGHTS_STATEMENT,
      copy.RATE_NOT_SET,
      copy.NO_PAYMENTS,
      copy.PRIVACY_NOTE,
      copy.NOT_REVIEWED_BY_FACTORY,
    ];
    for (const text of texts) expect(text).not.toMatch(FORBIDDEN);
  });

  it("has a label for every status and every payout state", () => {
    for (const s of copy.SUBMISSION_STATUSES) expect(copy.STATUS_LABELS[s].length).toBeGreaterThan(0);
    for (const s of copy.PAYOUT_STATES) expect(copy.PAYOUT_LABELS[s].length).toBeGreaterThan(0);
  });

  it("says nothing is paid from the screen, and that no rate means nothing accrues", () => {
    expect(copy.NO_PAYMENTS).toMatch(/does not pay/);
    expect(copy.RATE_NOT_SET).toMatch(/nothing accrues/);
  });
});
