/**
 * How the session cookies are set. The app never reads the session in the browser, so
 * the cookies are hidden from scripts: a script injected into a page cannot take them.
 */
type SessionCookieOptions = Readonly<{
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
}>;

export const sessionCookieOptions = (siteUrl: string): SessionCookieOptions => ({
  httpOnly: true,
  secure: new URL(siteUrl).protocol === "https:",
  sameSite: "lax",
  path: "/",
});
