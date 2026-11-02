import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/config/env";
import { SECRET_MIN_LENGTH } from "./token";

/**
 * `STORE_SERVICE_TOKEN` as the environment contract holds it (plan v5 O2, decision 0106). Optional,
 * server only, and set in no environment where tests run: with it unset every Store endpoint answers
 * 503 and reads nothing. No test here reaches a network and nothing is called.
 */

const base = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SECRET_KEY: "secret-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
};

describe("the Store contract's secret in the environment", () => {
  it("starts the app unset, which is how every environment runs today", () => {
    expect(parseEnv(base).STORE_SERVICE_TOKEN).toBeUndefined();
  });

  it("is taken when it is long enough to stand in front of every brand's products", () => {
    expect(parseEnv({ ...base, STORE_SERVICE_TOKEN: "s".repeat(SECRET_MIN_LENGTH) }).STORE_SERVICE_TOKEN).toHaveLength(SECRET_MIN_LENGTH);
  });

  it("stops the server for one too short, rather than signing with it", () => {
    expect(() => parseEnv({ ...base, STORE_SERVICE_TOKEN: "short" })).toThrow(/STORE_SERVICE_TOKEN is not valid/);
  });

  it("is unset where this test runs, so no test can reach a Store endpoint for real", () => {
    expect(process.env.STORE_SERVICE_TOKEN).toBeUndefined();
  });

  it("is in .env.example, commented out, with what happens when it is missing", () => {
    const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");

    expect(example).toMatch(/^# STORE_SERVICE_TOKEN=$/m);
    expect(example).toContain("answers 503 and reads nothing");
  });
});
