/**
 * THE CLUB PAGE'S HOST RULE (plan v6 C2, decision 0153; spec F-T6 "`<club>.knitwright.com`"). The root of
 * `<slug>.<root domain>` shows the club page, which lives at `/clubs/<slug>`; every other path on that host (a
 * store link, the page's own assets) is served as it is. Platform names are never a club (`reserved_subdomain` in
 * the migration keeps the same list for the database).
 *
 * Locally, with no wildcard DNS: open `/clubs/<slug>` directly (the path fallback), or set
 * `CLUB_PAGES_DOMAIN=localhost` and open `http://<slug>.localhost:3000/`, which browsers send to this machine.
 */

export const RESERVED_SUBDOMAINS: readonly string[] = [
  "www", "app", "api", "admin", "ops", "store", "stores", "shop", "mail", "email", "help", "support", "docs",
  "status", "static", "cdn", "assets", "auth", "login", "dashboard", "knitwright", "staging", "dev", "test",
  "preview", "studio", "team", "club", "clubs", "brand", "brands", "checkout", "pay", "billing",
];

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export const isClubSlug = (value: string): boolean => SLUG_PATTERN.test(value) && !value.includes("--") && !RESERVED_SUBDOMAINS.includes(value);

/** The club page's own path. */
export const clubPagePath = (slug: string): string => `/clubs/${slug}`;

/** The address a club's page is shared at. */
export const clubPageAddress = (slug: string, rootDomain: string | undefined, siteUrl: string): string =>
  rootDomain && rootDomain !== "localhost" ? `https://${slug}.${rootDomain}` : `${siteUrl.replace(/\/+$/, "")}${clubPagePath(slug)}`;

export function clubHost(host: string, pathname: string, rootDomain: string): string | null {
  const name = host.toLowerCase().replace(/:\d+$/, "");
  const suffix = `.${rootDomain.toLowerCase()}`;
  if (!name.endsWith(suffix) || pathname !== "/") return null;
  const label = name.slice(0, -suffix.length);
  return isClubSlug(label) ? clubPagePath(label) : null;
}
