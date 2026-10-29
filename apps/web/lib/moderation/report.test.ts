import { describe, expect, it, vi } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import type { BotCheckOutcome } from "@/lib/share/turnstile";
import { REPORT_LIMITS, reportSchema, submitReport, type ReportDeps } from "./report";

const GOOD = {
  reporterName: "Ada Lovelace",
  reporterEmail: "Ada@Example.COM ",
  holder: "Nike, Inc.",
  mark: "The swoosh",
  location: "https://example.com/a-product",
  details: "It is on the front of the shirt.",
  goodFaith: "yes",
  [CAPTCHA_FIELD]: "a-token",
};

const depsOf = (outcome: BotCheckOutcome = "passed", secret: string | null = "secret") => {
  const botCheck: ReportDeps["botCheck"] = vi.fn(async () => outcome);
  const save: ReportDeps["save"] = vi.fn(async () => "notice-1");
  const deps: ReportDeps = { botCheck, secret, address: "203.0.113.7", save };
  return { deps, botCheck: vi.mocked(botCheck), save: vi.mocked(save) };
};

describe("the report form", () => {
  it("takes a complete report, trims it and lowercases the address", () => {
    const parsed = reportSchema.parse(GOOD);
    expect(parsed.reporterEmail).toBe("ada@example.com");
    expect(parsed.reporterName).toBe("Ada Lovelace");
  });

  it("asks for every field a person must give", () => {
    for (const field of ["reporterName", "reporterEmail", "holder", "mark", "location"] as const) {
      expect(reportSchema.safeParse({ ...GOOD, [field]: "  " }).success, field).toBe(false);
    }
  });

  it("asks the reporter to confirm they act for the owner", () => {
    expect(reportSchema.safeParse({ ...GOOD, goodFaith: undefined }).success).toBe(false);
    expect(reportSchema.safeParse({ ...GOOD, goodFaith: "no" }).success).toBe(false);
  });

  it("asks for the bot check's answer", () => {
    expect(reportSchema.safeParse({ ...GOOD, [CAPTCHA_FIELD]: "" }).success).toBe(false);
  });

  it("refuses an address that is not one, and anything over the limits", () => {
    expect(reportSchema.safeParse({ ...GOOD, reporterEmail: "ada" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...GOOD, mark: "x".repeat(REPORT_LIMITS.mark + 1) }).success).toBe(false);
    expect(reportSchema.safeParse({ ...GOOD, details: "x".repeat(REPORT_LIMITS.details + 1) }).success).toBe(false);
  });

  it("keeps hidden characters and line breaks out of the one-line fields, but allows lines in the details", () => {
    expect(reportSchema.safeParse({ ...GOOD, mark: "Swoosh\u0007" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...GOOD, mark: "Line\none" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...GOOD, details: "One\nTwo\tThree" }).success).toBe(true);
    expect(reportSchema.safeParse({ ...GOOD, details: "One\u0007" }).success).toBe(false);
  });

  it("takes a report with no details at all", () => {
    expect(reportSchema.parse({ ...GOOD, details: undefined }).details).toBe("");
  });
});

describe("sending a report", () => {
  const input = reportSchema.parse(GOOD);

  it("checks the bot check against the reporter's address, then keeps the report", async () => {
    const { deps, botCheck, save } = depsOf();
    expect(await submitReport(deps, input)).toBe("notice-1");
    expect(botCheck).toHaveBeenCalledWith({ secret: "secret", token: "a-token", address: "203.0.113.7" });
    expect(save).toHaveBeenCalledWith({
      reporterName: "Ada Lovelace", reporterEmail: "ada@example.com", holder: "Nike, Inc.",
      mark: "The swoosh", location: "https://example.com/a-product", details: "It is on the front of the shirt.",
    });
  });

  it("keeps nothing when the bot check fails, and says which field to try again", async () => {
    const { deps, save } = depsOf("failed");
    await expect(submitReport(deps, input)).rejects.toMatchObject({ code: "invalid_input", fields: { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] } });
    expect(save).not.toHaveBeenCalled();
  });

  it("asks the reporter to come back when the bot check cannot be reached", async () => {
    const { deps, save } = depsOf("unreachable");
    await expect(submitReport(deps, input)).rejects.toMatchObject({ code: "unavailable" });
    expect(save).not.toHaveBeenCalled();
  });

  it("takes no report at all where no bot check is set up, rather than taking one unguarded", async () => {
    const { deps, botCheck, save } = depsOf("passed", null);
    await expect(submitReport(deps, input)).rejects.toMatchObject({ code: "unavailable" });
    expect(botCheck).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("never passes the bot check's answer on to what is kept", async () => {
    const { deps, save } = depsOf();
    await submitReport(deps, input);
    expect(save.mock.calls[0]![0]).not.toHaveProperty(CAPTCHA_FIELD);
    expect(save.mock.calls[0]![0]).not.toHaveProperty("goodFaith");
  });
});
