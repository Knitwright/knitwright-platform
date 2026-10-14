import { describe, expect, it } from "vitest";
import { patternLibraryOpenTo, patternsOpenTo } from "./access";

const local = { NEXT_PUBLIC_SITE_URL: "http://localhost:3000", NODE_ENV: "development" } as const;
const live = { NEXT_PUBLIC_SITE_URL: "https://app.knitwright.com", NODE_ENV: "production", VERCEL_ENV: "production" } as const;

describe("patternsOpenTo", () => {
  it("is closed to everyone when no pattern provider is set", () => {
    expect(patternsOpenTo({ ...local }, "a@b.com")).toBe(false);
  });

  it("is open to anyone signed in on this machine", () => {
    expect(patternsOpenTo({ ...local, PATTERN_PROVIDER: "claude-bridge" }, "someone@example.com")).toBe(true);
  });

  it("is open to the owner alone on a live site, whatever the case of the address", () => {
    const env = { ...live, PATTERN_PROVIDER: "claude-bridge", OWNER_EMAIL: "owner@knitwright.com" } as const;
    expect(patternsOpenTo(env, "Owner@Knitwright.com")).toBe(true);
    expect(patternsOpenTo(env, "someone@example.com")).toBe(false);
    expect(patternsOpenTo(env, null)).toBe(false);
  });

  it("is closed on a live site that names no owner", () => {
    expect(patternsOpenTo({ ...live, PATTERN_PROVIDER: "claude-bridge" }, "owner@knitwright.com")).toBe(false);
  });
});

describe("patternLibraryOpenTo", () => {
  it("is open to anyone signed in on this machine, with or without a pattern provider", () => {
    expect(patternLibraryOpenTo({ ...local }, "someone@example.com")).toBe(true);
  });

  it("is open to the owner alone on a live site", () => {
    const env = { ...live, OWNER_EMAIL: "owner@knitwright.com" } as const;
    expect(patternLibraryOpenTo(env, "Owner@Knitwright.com")).toBe(true);
    expect(patternLibraryOpenTo(env, "someone@example.com")).toBe(false);
    expect(patternLibraryOpenTo(env, null)).toBe(false);
    expect(patternLibraryOpenTo({ ...live }, "owner@knitwright.com")).toBe(false);
  });
});
