import { describe, expect, it, vi } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { reason, verdictOf } from "@/lib/moderation/types";
import { AppError } from "@/lib/server/core/errors";
import { LIMITS } from "@/lib/server/limits";
import type { OpenSignup } from "./service";
import { takeAnswer, type SubmitDeps, type SubmitForm } from "./submit";
import type { ZoneLimit } from "./zones";

const FORM: SubmitForm = {
  token: "t".repeat(43),
  name: "MORGAN",
  number: "7",
  sizeLabel: "M",
  wearerGroup: "mens",
  [CAPTCHA_FIELD]: "widget-token",
};

const ZONES: readonly ZoneLimit[] = [
  { zone: "back-name", label: "Name across the upper back", maxCharacters: 12, ruleId: "R-PER-001", note: "R-PER-001" },
];

const opened = (patch: Partial<OpenSignup> = {}): OpenSignup => ({
  linkId: "11111111-1111-4111-8111-111111111111",
  brandId: "22222222-2222-4222-8222-222222222222",
  clubName: "Northside Hockey Club",
  seasonName: "2027",
  expiresAt: "2026-12-01T00:00:00Z",
  numberRule: { sport: "football", label: "Football", lowest: 1, highest: 99, leadingZeroAllowed: true, ruleId: "R-GAP-000", note: "" },
  nameMaxCharacters: 12,
  nameRuleId: "R-PER-001",
  ...patch,
});

const deps = (patch: Partial<SubmitDeps> = {}): SubmitDeps => ({
  hitLinkLimit: vi.fn(async () => true),
  botCheck: vi.fn(async () => "passed" as const),
  secret: "a-secret",
  address: "203.0.113.4",
  rule: LIMITS.rosterSignupWriteLink,
  open: vi.fn(async () => opened()),
  zones: vi.fn(async () => ZONES),
  screen: vi.fn(async () => verdictOf([])),
  save: vi.fn(async () => undefined),
  visitorKey: "v".repeat(43),
  ...patch,
});

const refusal = async (given: SubmitDeps, form: SubmitForm = FORM): Promise<AppError> => {
  const error = await takeAnswer(given, form).catch((raised: unknown) => raised);
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
};

describe("takeAnswer", () => {
  it("keeps the answer and says what it kept, with the rules every check came from", async () => {
    const save = vi.fn(async () => undefined);
    const taken = await takeAnswer(deps({ save }), FORM);

    expect(taken).toMatchObject({ name: "MORGAN", number: "7" });
    expect(taken.ruleIds).toEqual(["R-PER-001", "R-GAP-000"]);
    expect(save).toHaveBeenCalledWith({
      token: FORM.token,
      visitorKey: "v".repeat(43),
      name: "MORGAN",
      number: "7",
      sizeLabel: "M",
      wearerGroup: "mens",
    });
  });

  it("takes nothing at all where no bot-check secret is set", async () => {
    expect((await refusal(deps({ secret: null }))).code).toBe("unavailable");
  });

  it("tells a fault at Cloudflare apart from a check that did not pass", async () => {
    expect((await refusal(deps({ botCheck: vi.fn(async () => "unreachable" as const) }))).code).toBe("unavailable");
    const failed = await refusal(deps({ botCheck: vi.fn(async () => "failed" as const) }));
    expect(failed.fields?.[CAPTCHA_FIELD]).toEqual(["The check did not pass. Try it again."]);
  });

  it("counts the link's allowance only after the bot check passed", async () => {
    const hitLinkLimit = vi.fn(async () => true);
    await refusal(deps({ botCheck: vi.fn(async () => "failed" as const), hitLinkLimit }));

    expect(hitLinkLimit).not.toHaveBeenCalled();
  });

  it("names the link by a hash of its token, never by the token itself", async () => {
    const hitLinkLimit = vi.fn(async () => true);
    await takeAnswer(deps({ hitLinkLimit }), FORM);

    expect(hitLinkLimit.mock.calls[0]?.[0]).not.toContain(FORM.token);
  });

  it("refuses once one link has taken all it may, whatever the address", async () => {
    expect((await refusal(deps({ hitLinkLimit: vi.fn(async () => false) }))).code).toBe("rate_limited");
  });

  it("tells a player plainly that the link is gone, and who to ask", async () => {
    const gone = await refusal(deps({ open: vi.fn(async () => null) }));

    expect(gone.code).toBe("not_found");
    expect(gone.message).toContain("Ask the person at your club");
  });

  it("refuses a name longer than the zone's row allows, against that row's rule", async () => {
    const refused = await refusal(deps(), { ...FORM, name: "VANDERBERGHESEN" });

    expect(refused.fields?.name?.[0]).toContain("fits 12 characters");
  });

  it("refuses a number the sport's row does not allow", async () => {
    const refused = await refusal(deps(), { ...FORM, number: "0" });

    expect(refused.fields?.number?.[0]).toBe("A football number is 1 to 99.");
  });

  it("checks the name and the number before it writes anything", async () => {
    const save = vi.fn(async () => undefined);
    await refusal(deps({ save }), { ...FORM, number: "0" });

    expect(save).not.toHaveBeenCalled();
  });

  it("screens the name through moderation and refuses what it blocks, in moderation's own words", async () => {
    const blocked = verdictOf([reason("profanity", "block", "This contains a word we do not print. Choose other words.", "x")]);
    const save = vi.fn(async () => undefined);
    const refused = await refusal(deps({ screen: vi.fn(async () => blocked), save }));

    expect(refused.fields?.name?.[0]).toBe("This contains a word we do not print. Choose other words.");
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps a name moderation only flagged, and hands the verdict back so the club is told", async () => {
    const flagged = verdictOf([reason("brand_term", "flag", "A person will check it.", "Arsenal")]);
    const taken = await takeAnswer(deps({ screen: vi.fn(async () => flagged) }), FORM);

    expect(taken.verdict.result).toBe("flagged");
    expect(taken.ruleIds).toContain("R-GAP-000");
  });

  it("screens the name for the club the token names, never a club the form could name", async () => {
    const screen = vi.fn(async () => verdictOf([]));
    await takeAnswer(deps({ screen }), FORM);

    expect(screen).toHaveBeenCalledWith({ brandId: "22222222-2222-4222-8222-222222222222", text: "MORGAN" });
  });

  it("falls back to the gap rule where no zone row names one, rather than inventing a rule", async () => {
    const other: readonly ZoneLimit[] = [{ ...ZONES[0], zone: "front-number", ruleId: "R-GAP-000" }] as readonly ZoneLimit[];
    const refused = await refusal(deps({ zones: vi.fn(async () => other) }));

    expect(refused.fields?.name?.[0]).toContain("has not set how long a shirt name may be");
  });
});
