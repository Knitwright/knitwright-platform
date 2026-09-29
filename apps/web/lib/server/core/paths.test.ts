import { describe, expect, it } from "vitest";
import { HOME_AFTER_SIGN_IN, SIGN_IN_PATH, redirectFor } from "./paths";

describe("redirectFor", () => {
  it("sends a visitor who is not signed in away from the studio", () => {
    expect(redirectFor("/studio", false)).toBe(SIGN_IN_PATH);
    expect(redirectFor("/studio/designs/abc", false)).toBe(SIGN_IN_PATH);
    expect(redirectFor("/reset-password", false)).toBe(SIGN_IN_PATH);
  });

  it("sends a visitor who is not signed in away from the brand pages", () => {
    expect(redirectFor("/welcome", false)).toBe(SIGN_IN_PATH);
    expect(redirectFor("/brands", false)).toBe(SIGN_IN_PATH);
    expect(redirectFor("/welcome", true)).toBeNull();
    expect(redirectFor("/brands", true)).toBeNull();
  });

  it("lets a signed-in user into the studio", () => {
    expect(redirectFor("/studio", true)).toBeNull();
    expect(redirectFor("/reset-password", true)).toBeNull();
  });

  it("sends a signed-in user past the sign-in and sign-up pages", () => {
    expect(redirectFor("/sign-in", true)).toBe(HOME_AFTER_SIGN_IN);
    expect(redirectFor("/sign-up", true)).toBe(HOME_AFTER_SIGN_IN);
    expect(redirectFor("/forgot-password", true)).toBe(HOME_AFTER_SIGN_IN);
  });

  it("leaves public pages alone", () => {
    expect(redirectFor("/", false)).toBeNull();
    expect(redirectFor("/", true)).toBeNull();
    expect(redirectFor("/sign-in", false)).toBeNull();
    expect(redirectFor("/auth/confirm", false)).toBeNull();
    expect(redirectFor("/auth/confirm", true)).toBeNull();
  });

  it("does not treat a path that only starts with the same letters as protected", () => {
    expect(redirectFor("/studios", false)).toBeNull();
    expect(redirectFor("/sign-in-help", true)).toBeNull();
  });

  it("leaves API routes to answer for themselves, since they answer in JSON", () => {
    expect(redirectFor("/api/me", false)).toBeNull();
  });
});
