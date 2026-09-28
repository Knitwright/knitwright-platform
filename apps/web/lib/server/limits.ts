import type { RateLimitRule } from "./core/guard";

/**
 * Every rate limit in one place. Each applies per address and, when the caller is
 * signed in, per user as well.
 */
const MINUTE = 60;
const HOUR = 60 * MINUTE;

export const LIMITS = {
  signUp: { name: "sign-up", limit: 5, windowSeconds: HOUR },
  signIn: { name: "sign-in", limit: 10, windowSeconds: 10 * MINUTE },
  passwordReset: { name: "password-reset", limit: 5, windowSeconds: HOUR },
  confirmLink: { name: "confirm-link", limit: 10, windowSeconds: 10 * MINUTE },
  oauthStart: { name: "oauth-start", limit: 20, windowSeconds: 10 * MINUTE },
  oauthReturn: { name: "oauth-return", limit: 20, windowSeconds: 10 * MINUTE },
  updatePassword: { name: "update-password", limit: 5, windowSeconds: HOUR },
  signOut: { name: "sign-out", limit: 30, windowSeconds: 10 * MINUTE },
  read: { name: "read", limit: 120, windowSeconds: MINUTE },
} as const satisfies Record<string, RateLimitRule>;
