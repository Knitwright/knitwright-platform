import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/config/env";
import { filesServiceConfigured, filesServiceFrom } from "./index";

/**
 * `FILES_SERVICE_URL` and `FILES_SERVICE_TOKEN` as the environment contract holds them (plan v5 X5b item 4,
 * owner decision 2). Both are optional, both are unset everywhere today, and with either one missing the
 * platform uses the stub. No test here reaches a network: nothing is called, only chosen.
 */

const base = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SECRET_KEY: "secret-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
};

const SECRET = "t".repeat(32);

describe("the files service in the environment contract", () => {
  it("starts the app with neither variable set, which is how every environment runs today", () => {
    const env = parseEnv(base);
    expect(env.FILES_SERVICE_URL).toBeUndefined();
    expect(env.FILES_SERVICE_TOKEN).toBeUndefined();
    expect(filesServiceFrom(env).name).toBe("files-service-stub");
    expect(filesServiceConfigured(env)).toBe(false);
  });

  it("takes an address and a secret together, and only then is the client chosen", () => {
    const env = parseEnv({ ...base, FILES_SERVICE_URL: "https://files.example.invalid", FILES_SERVICE_TOKEN: SECRET });
    expect(filesServiceFrom(env).name).toBe("files-service-http");
    expect(filesServiceConfigured(env)).toBe(true);
  });

  it("refuses an address that is not a URL, so a typo stops the server instead of a request", () => {
    expect(() => parseEnv({ ...base, FILES_SERVICE_URL: "files.example.invalid" })).toThrow(/FILES_SERVICE_URL is not valid/);
  });

  it("refuses a short secret: the token it signs is the only thing standing in front of a paid endpoint", () => {
    expect(() => parseEnv({ ...base, FILES_SERVICE_TOKEN: "short" })).toThrow(/FILES_SERVICE_TOKEN is not valid/);
  });

  it("gives the stub when only one of the two is set, rather than calling an unauthenticated service", () => {
    expect(filesServiceFrom(parseEnv({ ...base, FILES_SERVICE_URL: "https://files.example.invalid" })).name).toBe("files-service-stub");
    expect(filesServiceFrom(parseEnv({ ...base, FILES_SERVICE_TOKEN: SECRET })).name).toBe("files-service-stub");
  });

  it("is in .env.example, commented out, so nobody sets one half of the pair by copying it", async () => {
    const { readFileSync } = await import("node:fs");
    const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
    expect(example).toMatch(/^# FILES_SERVICE_URL=$/m);
    expect(example).toMatch(/^# FILES_SERVICE_TOKEN=$/m);
  });
});
