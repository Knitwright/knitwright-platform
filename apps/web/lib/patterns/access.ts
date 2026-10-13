import { servesRealPeople, type Env } from "@/lib/config/env";

/**
 * Who may ask for patterns. With the claude-bridge, a pattern is only made while the owner's
 * own Claude session is open, so on a site real people visit it is the owner's test alone:
 * everyone else is told patterns are not set up yet. On this machine anyone signed in may.
 */
export function patternsOpenTo(
  env: Pick<Env, "PATTERN_PROVIDER" | "OWNER_EMAIL" | "VERCEL_ENV" | "NODE_ENV" | "NEXT_PUBLIC_SITE_URL">,
  email: string | null,
): boolean {
  if (!env.PATTERN_PROVIDER) return false;
  if (!servesRealPeople(env)) return true;
  return Boolean(env.OWNER_EMAIL && email && email.toLowerCase() === env.OWNER_EMAIL);
}
