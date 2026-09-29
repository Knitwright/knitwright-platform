/**
 * Which pages need a session. proxy.ts uses this for an early redirect only. It is a
 * convenience, not the check: every page, route and action verifies the session itself.
 */

export const SIGN_IN_PATH = "/sign-in";
export const HOME_AFTER_SIGN_IN = "/studio";
export const CHOOSE_PASSWORD_PATH = "/reset-password";
/** Where someone with no brand yet is sent to create their first. */
export const WELCOME_PATH = "/welcome";
export const BRANDS_PATH = "/brands";

const NEEDS_SESSION = [
  HOME_AFTER_SIGN_IN,
  CHOOSE_PASSWORD_PATH,
  WELCOME_PATH,
  BRANDS_PATH,
] as const;
const FOR_VISITORS = ["/sign-in", "/sign-up", "/forgot-password"] as const;

const isUnder = (pathname: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** Where to send the visitor instead, or null to let the request through. */
export const redirectFor = (pathname: string, signedIn: boolean): string | null => {
  if (!signedIn && isUnder(pathname, NEEDS_SESSION)) return SIGN_IN_PATH;
  if (signedIn && isUnder(pathname, FOR_VISITORS)) return HOME_AFTER_SIGN_IN;
  return null;
};
