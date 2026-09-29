import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SECRET_KEY: "secret-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
};

const without = (name: keyof typeof valid) =>
  Object.fromEntries(Object.entries(valid).filter(([key]) => key !== name));

describe("parseEnv", () => {
  it("returns typed values when every required variable is present", () => {
    const env = parseEnv(valid);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.SUPABASE_SECRET_KEY).toBe("secret-key");
  });

  it.each(Object.keys(valid) as (keyof typeof valid)[])("requires %s", (name) => {
    expect(() => parseEnv(without(name))).toThrow(new RegExp(`${name} is missing`));
  });

  it("names every missing variable in one message", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    try {
      parseEnv({});
      expect.unreachable();
    } catch (error) {
      expect((error as EnvError).problems).toHaveLength(Object.keys(valid).length);
    }
  });

  it("rejects a site URL that is not a URL", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SITE_URL is not valid/,
    );
  });

  it("treats an empty string as missing", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "" })).toThrow(
      /NEXT_PUBLIC_SITE_URL is missing/,
    );
  });

  it("never echoes a variable's value in the error", () => {
    try {
      parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "secret-looking-value" });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("secret-looking-value");
    }
  });

  it("does not mutate its input", () => {
    const source = Object.freeze({ ...valid });
    expect(() => parseEnv(source)).not.toThrow();
  });

  it("has no owner address unless one is given", () => {
    expect(parseEnv(valid).OWNER_EMAIL).toBeUndefined();
  });

  it("stores the owner address in lower case, as the allowed list compares it", () => {
    expect(parseEnv({ ...valid, OWNER_EMAIL: "Owner@Example.COM" }).OWNER_EMAIL).toBe(
      "owner@example.com",
    );
  });

  it("rejects an owner address that is not an email address", () => {
    expect(() => parseEnv({ ...valid, OWNER_EMAIL: "owner" })).toThrow(/OWNER_EMAIL is not valid/);
  });

  it("offers sign-in with Google only for the exact value true", () => {
    expect(parseEnv(valid).GOOGLE_SIGN_IN).toBe(false);
    expect(parseEnv({ ...valid, GOOGLE_SIGN_IN: "true" }).GOOGLE_SIGN_IN).toBe(true);
    expect(parseEnv({ ...valid, GOOGLE_SIGN_IN: "1" }).GOOGLE_SIGN_IN).toBe(false);
  });

  it("reads the caller's address from the header Vercel writes, unless told otherwise", () => {
    expect(parseEnv(valid).CLIENT_ADDRESS_HEADER).toBe("x-vercel-forwarded-for");
    expect(parseEnv({ ...valid, CLIENT_ADDRESS_HEADER: "X-Real-IP" }).CLIENT_ADDRESS_HEADER).toBe(
      "x-real-ip",
    );
  });

  it("gives every usage allowance and the safety ceiling a default", () => {
    const env = parseEnv(valid);
    expect(env.USAGE_USER_DAILY_AI).toBeGreaterThan(0);
    expect(env.USAGE_BRAND_DAILY_AI).toBeGreaterThanOrEqual(env.USAGE_USER_DAILY_AI);
    expect(env.USAGE_USER_DAILY_PHOTOREAL).toBeGreaterThan(0);
    expect(env.USAGE_BRAND_DAILY_PHOTOREAL).toBeGreaterThanOrEqual(
      env.USAGE_USER_DAILY_PHOTOREAL,
    );
    expect(env.USAGE_GLOBAL_DAILY_CEILING).toBeGreaterThan(env.USAGE_BRAND_DAILY_PHOTOREAL);
  });

  it("lets the owner set an allowance or the ceiling, in microdollars", () => {
    const env = parseEnv({ ...valid, USAGE_GLOBAL_DAILY_CEILING: "50000000" });
    expect(env.USAGE_GLOBAL_DAILY_CEILING).toBe(50_000_000);
    expect(parseEnv({ ...valid, USAGE_USER_DAILY_AI: "0" }).USAGE_USER_DAILY_AI).toBe(0);
  });

  it.each(["-1", "1.5", "lots"])("rejects an allowance of %s", (value) => {
    expect(() => parseEnv({ ...valid, USAGE_BRAND_DAILY_AI: value })).toThrow(
      /USAGE_BRAND_DAILY_AI is not valid/,
    );
  });

  it("rejects a header name that could not be a header", () => {
    expect(() => parseEnv({ ...valid, CLIENT_ADDRESS_HEADER: "x real ip" })).toThrow(
      /CLIENT_ADDRESS_HEADER is not valid/,
    );
  });

  it("needs no AI key, and picks the cheapest Claude with a stronger one for the retry by default", () => {
    const env = parseEnv(valid);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.INTENT_MODEL).toBe("claude-haiku-4-5");
    expect(env.INTENT_RETRY_MODEL).toBe("claude-sonnet-5-5");
  });

  it("accepts only models from the catalog", () => {
    expect(parseEnv({ ...valid, INTENT_MODEL: "gpt-5-nano" }).INTENT_MODEL).toBe("gpt-5-nano");
    expect(() => parseEnv({ ...valid, INTENT_MODEL: "some-model" })).toThrow(/INTENT_MODEL is not valid/);
  });

  it("has no image model key unless one is given, so photoreal images are shown as unavailable", () => {
    expect(parseEnv(valid).GEMINI_API_KEY).toBeUndefined();
    expect(parseEnv({ ...valid, GEMINI_API_KEY: "" }).GEMINI_API_KEY).toBeUndefined();
    expect(parseEnv({ ...valid, GEMINI_API_KEY: "a-key" }).GEMINI_API_KEY).toBe("a-key");
  });

  it("rejects an image model key with spaces in it", () => {
    expect(() => parseEnv({ ...valid, GEMINI_API_KEY: "a key" })).toThrow(/GEMINI_API_KEY is not valid/);
  });
});
