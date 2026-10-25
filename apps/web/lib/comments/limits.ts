import type { RateLimitRule } from "@/lib/server/core/guard";

/** The same numbers are written in supabase/migrations/20261028040000_design_comments.sql; limits.test.ts reads it and fails if they drift. */
export const EDIT_WINDOW_MINUTES = 15;
export const MAX_MENTIONS = 10;
export const MAX_COMMENTS_PER_DESIGN = 500;
export const MAX_REPLIES_PER_THREAD = 200;
export const MAX_PER_PERSON_PER_10_MINUTES = 30;

/** Per address and per person, like every route (lib/server/limits.ts). The database holds a second, per-person limit. */
export const COMMENT_LIMITS = {
  write: { name: "comment-write", limit: 30, windowSeconds: 10 * 60 },
  change: { name: "comment-change", limit: 60, windowSeconds: 10 * 60 },
} as const satisfies Record<string, RateLimitRule>;
