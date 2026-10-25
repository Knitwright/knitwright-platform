import { describe, expect, it } from "vitest";
import { EnvError, parseEnv, turnstileSecret, unsubscribeSecret } from "./env";

const valid = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SECRET_KEY: "secret-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
};

const UNSUBSCRIBE = "u".repeat(32);

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

  it("rejects a Supabase URL with a path after the address, which sends every call to a wrong path", () => {
    for (const value of [
      "https://abc.supabase.co/rest/v1",
      "https://abc.supabase.co/rest/v1/",
      "https://abc.supabase.co/project/abc",
      "https://abc.supabase.co?x=1",
    ]) {
      expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: value }), value).toThrow(
        /NEXT_PUBLIC_SUPABASE_URL is not valid/,
      );
    }
  });

  it("accepts a Supabase URL that is only the address, with or without a closing slash", () => {
    expect(parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" }).NEXT_PUBLIC_SUPABASE_URL).toBe(
      "https://abc.supabase.co",
    );
    expect(parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/" }).NEXT_PUBLIC_SUPABASE_URL).toBe(
      "https://abc.supabase.co/",
    );
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

  it("charges credits only when CREDITS_ENFORCED is exactly true", () => {
    expect(parseEnv(valid).CREDITS_ENFORCED).toBe(false);
    expect(parseEnv({ ...valid, CREDITS_ENFORCED: "true" }).CREDITS_ENFORCED).toBe(true);
    expect(parseEnv({ ...valid, CREDITS_ENFORCED: "1" }).CREDITS_ENFORCED).toBe(false);
  });

  it("hides the 3D view unless SHOW_3D is exactly true", () => {
    expect(parseEnv(valid).SHOW_3D).toBe(false);
    expect(parseEnv({ ...valid, SHOW_3D: "true" }).SHOW_3D).toBe(true);
    expect(parseEnv({ ...valid, SHOW_3D: "yes" }).SHOW_3D).toBe(false);
    expect(parseEnv({ ...valid, SHOW_3D: "" }).SHOW_3D).toBe(false);
  });

  it("reads the caller's address from the header Vercel writes, unless told otherwise", () => {
    expect(parseEnv(valid).CLIENT_ADDRESS_HEADER).toBe("x-vercel-forwarded-for");
    expect(parseEnv({ ...valid, CLIENT_ADDRESS_HEADER: "X-Real-IP" }).CLIENT_ADDRESS_HEADER).toBe(
      "x-real-ip",
    );
  });

  it("gives every usage allowance and the safety ceiling a default", () => {
    const env = parseEnv(valid);
    expect(env.USAGE_USER_MONTHLY_AI).toBeGreaterThan(0);
    expect(env.USAGE_BRAND_MONTHLY_AI).toBeGreaterThanOrEqual(env.USAGE_USER_MONTHLY_AI);
    expect(env.USAGE_USER_MONTHLY_PHOTOREAL).toBeGreaterThan(0);
    expect(env.USAGE_BRAND_MONTHLY_PHOTOREAL).toBeGreaterThanOrEqual(
      env.USAGE_USER_MONTHLY_PHOTOREAL,
    );
    expect(env.USAGE_GLOBAL_DAILY_CEILING).toBeGreaterThan(0);
  });

  it("lets the owner set an allowance or the ceiling, in microdollars", () => {
    const env = parseEnv({ ...valid, USAGE_GLOBAL_DAILY_CEILING: "50000000" });
    expect(env.USAGE_GLOBAL_DAILY_CEILING).toBe(50_000_000);
    expect(parseEnv({ ...valid, USAGE_USER_MONTHLY_AI: "0" }).USAGE_USER_MONTHLY_AI).toBe(0);
  });

  it.each(["-1", "1.5", "lots"])("rejects an allowance of %s", (value) => {
    expect(() => parseEnv({ ...valid, USAGE_BRAND_MONTHLY_AI: value })).toThrow(
      /USAGE_BRAND_MONTHLY_AI is not valid/,
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

  describe("Cloudflare's test site keys", () => {
    const testKeys = [
      "1x00000000000000000000AA",
      "2x00000000000000000000AB",
      "1x00000000000000000000BB",
      "2x00000000000000000000BB",
      "3x00000000000000000000FF",
    ];
    const live = { ...valid, NEXT_PUBLIC_SITE_URL: "https://knitwright.com" };

    it.each(testKeys)("refuses %s on a Vercel production deploy", (key) => {
      expect(() =>
        parseEnv({ ...valid, NEXT_PUBLIC_TURNSTILE_SITE_KEY: key, VERCEL_ENV: "production" }),
      ).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY is a test key/);
    });

    it.each(testKeys)("refuses %s in a production build served on a public address", (key) => {
      expect(() =>
        parseEnv({ ...live, NEXT_PUBLIC_TURNSTILE_SITE_KEY: key, NODE_ENV: "production" }),
      ).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY is a test key/);
    });

    it("allows a test key in a production build served on this machine, as the browser tests do", () => {
      for (const site of ["http://localhost:3100", "http://127.0.0.1:3100"]) {
        expect(() =>
          parseEnv({
            ...valid,
            NEXT_PUBLIC_SITE_URL: site,
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: testKeys[0],
            NODE_ENV: "production",
          }),
        ).not.toThrow();
      }
    });

    it("allows a test key in development and in tests", () => {
      for (const mode of ["development", "test", undefined]) {
        expect(() =>
          parseEnv({ ...live, NEXT_PUBLIC_TURNSTILE_SITE_KEY: testKeys[0], NODE_ENV: mode }),
        ).not.toThrow();
      }
    });

    it("allows a real key in production", () => {
      expect(() =>
        parseEnv({
          ...live,
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAreal-key",
          UNSUBSCRIBE_SECRET: UNSUBSCRIBE,
          NODE_ENV: "production",
          VERCEL_ENV: "production",
        }),
      ).not.toThrow();
    });
  });

  describe("the Turnstile secret, for bot checks the app makes itself (share pages)", () => {
    const TEST_SECRETS = [
      "1x0000000000000000000000000000000AA",
      "2x0000000000000000000000000000000AA",
      "3x0000000000000000000000000000000AA",
    ];

    it("uses the secret that is set", () => {
      expect(turnstileSecret(parseEnv({ ...valid, TURNSTILE_SECRET_KEY: "0x4AAAreal" }))).toBe("0x4AAAreal");
    });

    it("falls back to Cloudflare's always-pass test secret on this machine and in tests", () => {
      expect(turnstileSecret(parseEnv(valid))).toBe(TEST_SECRETS[0]);
      expect(turnstileSecret(parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "http://localhost:3100", NODE_ENV: "production" }))).toBe(
        TEST_SECRETS[0],
      );
    });

    it("has none wherever real people visit and no secret is set, so share pages refuse answers", () => {
      expect(turnstileSecret(parseEnv({ ...valid, VERCEL_ENV: "production", UNSUBSCRIBE_SECRET: UNSUBSCRIBE }))).toBeNull();
      expect(turnstileSecret(parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "https://knitwright.com", NODE_ENV: "production", UNSUBSCRIBE_SECRET: UNSUBSCRIBE }))).toBeNull();
    });

    it.each(TEST_SECRETS)("refuses the test secret %s wherever real people visit", (secret) => {
      expect(() => parseEnv({ ...valid, TURNSTILE_SECRET_KEY: secret, VERCEL_ENV: "production" })).toThrow(
        /TURNSTILE_SECRET_KEY is a test key/,
      );
      expect(() => parseEnv({ ...valid, TURNSTILE_SECRET_KEY: secret })).not.toThrow();
    });
  });

  describe("the unsubscribe secret, which signs the links in marketing email", () => {
    it("uses the secret that is set", () => {
      expect(unsubscribeSecret(parseEnv({ ...valid, UNSUBSCRIBE_SECRET: UNSUBSCRIBE }))).toBe(UNSUBSCRIBE);
    });

    it("falls back to the server's secret key on this machine and in tests", () => {
      expect(unsubscribeSecret(parseEnv(valid))).toBe("secret-key");
      expect(
        unsubscribeSecret(parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "http://localhost:3100", NODE_ENV: "production" })),
      ).toBe("secret-key");
    });

    it("is required wherever real people visit, so changing the secret key never breaks a sent link", () => {
      expect(() => parseEnv({ ...valid, VERCEL_ENV: "production" })).toThrow(/UNSUBSCRIBE_SECRET is missing/);
      expect(() =>
        parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "https://knitwright.com", NODE_ENV: "production" }),
      ).toThrow(/UNSUBSCRIBE_SECRET is missing/);
      expect(() => parseEnv({ ...valid, VERCEL_ENV: "production", UNSUBSCRIBE_SECRET: UNSUBSCRIBE })).not.toThrow();
    });

    it("is at least 32 characters", () => {
      expect(() => parseEnv({ ...valid, UNSUBSCRIBE_SECRET: "u".repeat(31) })).toThrow(/UNSUBSCRIBE_SECRET is not valid/);
    });
  });

  describe("the pattern bridge", () => {
    it("is allowed on a deploy only when the owner is named, since it is the owner's test alone", () => {
      expect(() => parseEnv({ ...valid, UNSUBSCRIBE_SECRET: UNSUBSCRIBE, PATTERN_PROVIDER: "claude-bridge", VERCEL_ENV: "production" })).toThrow(
        /PATTERN_PROVIDER=claude-bridge needs OWNER_EMAIL/,
      );
      expect(
        parseEnv({ ...valid, UNSUBSCRIBE_SECRET: UNSUBSCRIBE, PATTERN_PROVIDER: "claude-bridge", OWNER_EMAIL: "owner@example.com", VERCEL_ENV: "production" }).PATTERN_PROVIDER,
      ).toBe("claude-bridge");
    });

    it("is allowed on this machine without an owner", () => {
      expect(parseEnv({ ...valid, PATTERN_PROVIDER: "claude-bridge" }).PATTERN_PROVIDER).toBe("claude-bridge");
    });
  });

  describe("the stand-in model for browser tests", () => {
    it("is off unless switched on", () => {
      expect(parseEnv(valid).AI_PROVIDER_STUB).toBeUndefined();
      expect(parseEnv({ ...valid, AI_PROVIDER_STUB: "on" }).AI_PROVIDER_STUB).toBe("on");
    });

    it("is allowed in a production build served on this machine, as the browser tests do", () => {
      expect(() =>
        parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "http://localhost:3100", AI_PROVIDER_STUB: "on", NODE_ENV: "production" }),
      ).not.toThrow();
    });

    it("is refused wherever real people sign in", () => {
      expect(() => parseEnv({ ...valid, AI_PROVIDER_STUB: "on", VERCEL_ENV: "production" })).toThrow(
        /AI_PROVIDER_STUB is for browser tests/,
      );
      expect(() =>
        parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "https://knitwright.com", AI_PROVIDER_STUB: "on", NODE_ENV: "production" }),
      ).toThrow(/AI_PROVIDER_STUB is for browser tests/);
    });
  });
});
