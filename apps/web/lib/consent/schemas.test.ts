import { describe, expect, it } from "vitest";
import { googleSignUpSchema, marketingChoiceSchema, parseSignupChoice, signupChoiceValue, unsubscribeSchema } from "./schemas";

describe("marketingChoiceSchema", () => {
  it("reads a ticked box as yes and a missing one as no", () => {
    expect(marketingChoiceSchema.parse({ marketing_email: "yes" })).toEqual({ granted: true });
    expect(marketingChoiceSchema.parse({})).toEqual({ granted: false });
  });

  it("refuses any other value", () => {
    expect(marketingChoiceSchema.safeParse({ marketing_email: "on" }).success).toBe(false);
  });
});

describe("googleSignUpSchema", () => {
  it("says nothing was asked when the form carried no choice (the sign-in page)", () => {
    expect(googleSignUpSchema.parse({})).toEqual({ marketing: null });
  });

  it("carries the choice from the sign-up page", () => {
    expect(googleSignUpSchema.parse({ marketing_email: "yes" })).toEqual({ marketing: true });
    expect(googleSignUpSchema.parse({ marketing_email: "no" })).toEqual({ marketing: false });
  });
});

describe("the sign-up choice kept while Google signs the person in", () => {
  it("goes there and back", () => {
    expect(parseSignupChoice(signupChoiceValue(true))).toBe(true);
    expect(parseSignupChoice(signupChoiceValue(false))).toBe(false);
  });

  it("is null when missing or unreadable", () => {
    expect(parseSignupChoice(undefined)).toBeNull();
    expect(parseSignupChoice("maybe")).toBeNull();
  });
});

describe("unsubscribeSchema", () => {
  it("takes a token of a sane length", () => {
    expect(unsubscribeSchema.parse({ token: "a.b" })).toEqual({ token: "a.b" });
    expect(unsubscribeSchema.safeParse({ token: "" }).success).toBe(false);
    expect(unsubscribeSchema.safeParse({ token: "x".repeat(1000) }).success).toBe(false);
  });
});
