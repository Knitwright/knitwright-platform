import { describe, expect, it } from "vitest";
import { canSendMarketing, consentEventsFrom, currentMarketingChoice, needsNewEvent, signupConsentData, type ConsentEvent } from "./consent";
import { MARKETING_OPT_IN } from "./wording";

const event = (granted: boolean, createdAt: string, purpose = "marketing_email"): ConsentEvent => ({
  purpose,
  granted,
  createdAt,
  source: "settings",
  wordingVersion: "marketing-email-v1",
});

describe("canSendMarketing", () => {
  it("says no when the person was never asked", () => {
    expect(canSendMarketing([])).toBe(false);
  });

  it("says yes only while the latest marketing choice is a yes", () => {
    expect(canSendMarketing([event(true, "2026-10-01T10:00:00Z")])).toBe(true);
    expect(canSendMarketing([event(true, "2026-10-01T10:00:00Z"), event(false, "2026-10-02T10:00:00Z")])).toBe(false);
    expect(canSendMarketing([event(false, "2026-10-01T10:00:00Z"), event(true, "2026-10-02T10:00:00Z")])).toBe(true);
  });

  it("goes by time, not by the order the events were given in", () => {
    expect(canSendMarketing([event(false, "2026-10-03T10:00:00Z"), event(true, "2026-10-02T10:00:00Z")])).toBe(false);
  });

  it("ignores choices about anything other than marketing email", () => {
    expect(canSendMarketing([event(true, "2026-10-02T10:00:00Z", "something_else")])).toBe(false);
    expect(canSendMarketing([event(true, "2026-10-01T10:00:00Z"), event(false, "2026-10-02T10:00:00Z", "something_else")])).toBe(true);
  });

  it("treats a withdrawal at the same moment as a yes as the answer, to be safe", () => {
    expect(canSendMarketing([event(true, "2026-10-01T10:00:00Z"), event(false, "2026-10-01T10:00:00Z")])).toBe(false);
    expect(canSendMarketing([event(false, "2026-10-01T10:00:00Z"), event(true, "2026-10-01T10:00:00Z")])).toBe(false);
  });

  it("says no for an event with a time that cannot be read", () => {
    expect(canSendMarketing([event(true, "not a time")])).toBe(false);
  });
});

describe("currentMarketingChoice", () => {
  it("is null when never asked, else the latest answer", () => {
    expect(currentMarketingChoice([])).toBeNull();
    expect(currentMarketingChoice([event(true, "2026-10-01T10:00:00Z")])?.granted).toBe(true);
  });
});

describe("needsNewEvent", () => {
  it("records a choice that differs from the current one, and the first choice ever", () => {
    expect(needsNewEvent([], false)).toBe(true);
    expect(needsNewEvent([], true)).toBe(true);
    expect(needsNewEvent([event(true, "2026-10-01T10:00:00Z")], false)).toBe(true);
  });

  it("does not record the same answer twice in a row", () => {
    expect(needsNewEvent([event(true, "2026-10-01T10:00:00Z")], true)).toBe(false);
    expect(needsNewEvent([event(false, "2026-10-01T10:00:00Z")], false)).toBe(false);
  });
});

describe("consentEventsFrom", () => {
  it("reads rows from the database into events", () => {
    expect(
      consentEventsFrom([
        { purpose: "marketing_email", granted: true, created_at: "2026-10-01T10:00:00Z", source: "sign-up", wording_version: "marketing-email-v1" },
      ]),
    ).toEqual([event(true, "2026-10-01T10:00:00Z")].map((entry) => ({ ...entry, source: "sign-up" })));
  });

  it("drops rows that are not shaped like events", () => {
    expect(consentEventsFrom([{ purpose: "marketing_email" }, null, "row"])).toEqual([]);
    expect(consentEventsFrom(null)).toEqual([]);
  });
});

describe("signupConsentData", () => {
  it("puts the choice and the version of the words in the new account's profile", () => {
    expect(signupConsentData(true)).toEqual({ marketing_email: { granted: true, version: MARKETING_OPT_IN.version } });
    expect(signupConsentData(false)).toEqual({ marketing_email: { granted: false, version: MARKETING_OPT_IN.version } });
  });
});
