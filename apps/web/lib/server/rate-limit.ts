import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimitRule } from "./core/guard";

type RateLimiter = (key: string, rule: RateLimitRule) => Promise<boolean>;

/**
 * Counts requests in Postgres through `rate_limit_hit`, which is atomic. If the count
 * cannot be kept the limiter throws, and the wrapper answers with an error: a request
 * is never let through uncounted.
 */
export const createRateLimiter =
  (admin: SupabaseClient): RateLimiter =>
  async (key, rule) => {
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) throw new Error("The rate limit could not be counted.", { cause: error });
    return data === true;
  };
