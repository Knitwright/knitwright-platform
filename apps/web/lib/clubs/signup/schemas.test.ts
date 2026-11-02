import { describe, expect, it } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import {
  applyAnswersSchema,
  chaseByEmailSchema,
  createSignupLinkSchema,
  pasteListSchema,
  rosterSignupSchema,
  signupLinkSchema,
} from "./schemas";

const TOKEN = "t".repeat(43);
const SEASON = "11111111-1111-4111-8111-111111111111";
const LINK = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";

const answer = (patch: Record<string, unknown> = {}) => ({
  token: TOKEN,
  name: "  Morgan  ",
  number: " 07 ",
  sizeLabel: " M ",
  wearerGroup: "mens",
  [CAPTCHA_FIELD]: "widget-token",
  ...patch,
});

describe("a player's answer", () => {
  it("cleans the name the way a roster and a team order clean one", () => {
    expect(rosterSignupSchema.parse(answer()).name).toBe("Morgan");
    expect(rosterSignupSchema.parse(answer({ name: "O'Shea-Smith" })).name).toBe("O'Shea-Smith");
  });

  it("keeps the number's digits as typed, because a shirt does", () => {
    expect(rosterSignupSchema.parse(answer()).number).toBe("07");
  });

  it("refuses a name of characters a shirt cannot print, and an empty one", () => {
    expect(rosterSignupSchema.safeParse(answer({ name: "MORGAN <3" })).success).toBe(false);
    expect(rosterSignupSchema.safeParse(answer({ name: "   " })).success).toBe(false);
    expect(rosterSignupSchema.safeParse(answer({ name: "x".repeat(300) })).success).toBe(false);
  });

  it("leaves the number's range to the sport's row and only asks for something", () => {
    // 500 is outside every seeded range; the row, not the schema, is what refuses it (numbers.ts).
    expect(rosterSignupSchema.parse(answer({ number: "500" })).number).toBe("500");
    expect(rosterSignupSchema.safeParse(answer({ number: "  " })).success).toBe(false);
  });

  it("refuses a token that could never open a link, and a cut this club does not use", () => {
    expect(rosterSignupSchema.safeParse(answer({ token: "short" })).success).toBe(false);
    expect(rosterSignupSchema.safeParse(answer({ wearerGroup: "veterans" })).success).toBe(false);
  });

  it("needs the bot check's answer and a size", () => {
    expect(rosterSignupSchema.safeParse({ ...answer(), [CAPTCHA_FIELD]: undefined }).success).toBe(false);
    expect(rosterSignupSchema.safeParse(answer({ sizeLabel: " " })).success).toBe(false);
  });
});

describe("the club's own forms", () => {
  it("names a season and a sport whose row exists", () => {
    expect(createSignupLinkSchema.parse({ seasonId: SEASON, sport: " football " }).sport).toBe("football");
    expect(createSignupLinkSchema.safeParse({ seasonId: SEASON, sport: "Football" }).success).toBe(false);
    expect(createSignupLinkSchema.safeParse({ seasonId: "not-a-season", sport: "football" }).success).toBe(false);
  });

  it("names the link to withdraw, the season to fold in and nothing else", () => {
    expect(signupLinkSchema.parse({ seasonId: SEASON, linkId: LINK })).toEqual({ seasonId: SEASON, linkId: LINK });
    expect(applyAnswersSchema.parse({ seasonId: SEASON })).toEqual({ seasonId: SEASON });
  });

  it("caps a pasted list rather than reading an unbounded one", () => {
    expect(pasteListSchema.parse({ seasonId: SEASON, list: "Alex Morgan" }).list).toBe("Alex Morgan");
    expect(pasteListSchema.safeParse({ seasonId: SEASON, list: "x".repeat(20_001) }).success).toBe(false);
  });

  it("takes only a sign-up address this server makes, so a club cannot be made to send a player elsewhere", () => {
    const good = { seasonId: SEASON, requestId: REQUEST, link: `https://knitwright.test/join/${TOKEN}` };

    expect(chaseByEmailSchema.parse(good).link).toBe(good.link);
    for (const link of ["https://evil.test/", `https://evil.test/join/${TOKEN}?x=1`, "https://knitwright.test/join/short", ""]) {
      expect(chaseByEmailSchema.safeParse({ ...good, link }).success, link).toBe(false);
    }
  });
});
