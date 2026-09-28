import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("returns typed values when every required variable is present", () => {
    const env = parseEnv(valid);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("defaults the sign-up switch to closed", () => {
    expect(parseEnv(valid).SIGNUP_OPEN).toBe(false);
  });

  it("opens sign-up only for the exact value true", () => {
    expect(parseEnv({ ...valid, SIGNUP_OPEN: "true" }).SIGNUP_OPEN).toBe(true);
    expect(parseEnv({ ...valid, SIGNUP_OPEN: "1" }).SIGNUP_OPEN).toBe(false);
    expect(parseEnv({ ...valid, SIGNUP_OPEN: "yes" }).SIGNUP_OPEN).toBe(false);
  });

  it("names every missing variable in one message", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects a site URL that is not a URL", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("treats an empty string as missing", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SITE_URL: "" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("never echoes a variable's value in the error", () => {
    try {
      parseEnv({ NEXT_PUBLIC_SITE_URL: "secret-looking-value" });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("secret-looking-value");
    }
  });

  it("does not mutate its input", () => {
    const source = Object.freeze({ ...valid });
    expect(() => parseEnv(source)).not.toThrow();
  });
});
