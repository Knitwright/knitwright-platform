import { describe, expect, it } from "vitest";
import { LIBRARY_NOT_OPEN, requireLibraryOpen } from "./access";

const env = (over: Record<string, string | undefined> = {}) => ({ OWNER_EMAIL: "owner@example.com", VERCEL_ENV: "production", NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://example.com", ...over }) as never;

describe("requireLibraryOpen", () => {
  it("lets the owner in on a site real people visit, and says plainly that it is not open for anyone else", () => {
    expect(() => requireLibraryOpen(env(), "OWNER@example.com")).not.toThrow();
    expect(() => requireLibraryOpen(env(), "someone@example.com")).toThrowError(LIBRARY_NOT_OPEN);
    expect(() => requireLibraryOpen(env(), null)).toThrow();
  });

  it("is open to anyone signed in on a development machine", () => {
    expect(() => requireLibraryOpen(env({ VERCEL_ENV: undefined, NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }), "x@y.z")).not.toThrow();
  });
});
