import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { createAdminClient, createSessionClient } from "@/lib/supabase/clients";
import { cookieJar, settings, uniqueKey } from "./support";

const rule = { name: "test", limit: 2, windowSeconds: 60 };

describe("createRateLimiter", () => {
  it("allows up to the limit and then refuses", async () => {
    const hit = createRateLimiter(createAdminClient(settings()));
    const key = uniqueKey();

    expect(await hit(key, rule)).toBe(true);
    expect(await hit(key, rule)).toBe(true);
    expect(await hit(key, rule)).toBe(false);
  });

  it("throws when the count cannot be kept, so a request is never let through uncounted", async () => {
    const withoutAccess = createRateLimiter(createSessionClient(settings(), cookieJar()));

    await expect(withoutAccess(uniqueKey(), rule)).rejects.toThrow(/rate limit/i);
  });
});
