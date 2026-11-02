import { newVisitorKey } from "@/lib/share/token";

/**
 * The sign-up page's own visitor cookie (plan v5 Z7, decision 0087).
 *
 * The share cookie is scoped to `/s`, so it never reaches `/join`. This is the same cookie in every
 * other way — httpOnly, lax, one random key per browser, hashed with the link before it is stored —
 * and the key itself is made by `lib/share/token.ts`, so there is one maker of visitor keys.
 */

export const SIGNUP_VISITOR_COOKIE = "kw_signup_visitor";

const NINETY_DAYS_IN_SECONDS = 60 * 60 * 24 * 90;

/** Hidden from scripts, sent only to sign-up pages, and kept as long as the longest link lasts. */
export const signupCookieOptions = (siteUrl: string) => ({
  httpOnly: true as const,
  secure: new URL(siteUrl).protocol === "https:",
  sameSite: "lax" as const,
  path: "/join",
  maxAge: NINETY_DAYS_IN_SECONDS,
});

/** The address a kit manager copies and sends to their squad. */
export const signupAddress = (siteUrl: string, token: string): string => `${siteUrl.replace(/\/+$/, "")}/join/${token}`;

export { newVisitorKey };
