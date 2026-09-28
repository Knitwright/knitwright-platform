import { describe, expect, it } from "vitest";
import { botCheckStatus } from "./bot-check-status";

const base = { attempt: 0, passedAttempt: null, failed: false, askedEarly: false } as const;

describe("botCheckStatus", () => {
  it("is waiting until the check for this attempt has passed", () => {
    expect(botCheckStatus(base)).toEqual({
      ready: false,
      tone: "info",
      message: "Checking that you are a person. This takes a moment.",
    });
  });

  it("is ready once the check for this attempt has passed, and then says nothing", () => {
    expect(botCheckStatus({ ...base, passedAttempt: 0 })).toEqual({
      ready: true,
      tone: "info",
      message: null,
    });
  });

  it("is not ready when the check that passed was for an earlier attempt", () => {
    // A token works once. After a submit the form needs a new one.
    expect(botCheckStatus({ ...base, attempt: 1, passedAttempt: 0 }).ready).toBe(false);
  });

  it("asks for patience when the button was pressed too early", () => {
    expect(botCheckStatus({ ...base, askedEarly: true })).toEqual({
      ready: false,
      tone: "warn",
      message: "The check has not finished yet. Wait a moment, then press the button again.",
    });
  });

  it("stops asking for patience once the check has passed", () => {
    expect(botCheckStatus({ ...base, passedAttempt: 0, askedEarly: true }).message).toBeNull();
  });

  it("says what to do when the check could not load at all", () => {
    expect(botCheckStatus({ ...base, failed: true })).toEqual({
      ready: false,
      tone: "warn",
      message:
        "The check could not load. Refresh the page. If that does not help, turn off content blockers for this site or try another browser.",
    });
  });

  it("puts a failure to load before everything else", () => {
    expect(botCheckStatus({ ...base, failed: true, askedEarly: true }).message).toMatch(
      /could not load/,
    );
  });
});
