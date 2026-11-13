import { RESERVED_SUBDOMAINS, SLUG_PATTERN } from "@/lib/team-stores/host";

/**
 * THE BRAND STOREFRONT'S HOST RULE (plan v6 C3, decision 0154; spec F-L5 "`<brand>.knitwright.com`").
 *
 * Brands and clubs share one namespace of names under one root domain (`CLUB_PAGES_DOMAIN`, `lib/hosts/rules.ts`):
 * the database refuses a brand slug that is reserved or a club's, and a club slug that is a brand's. So this rule
 * claims every name: it rewrites `<slug>.<root>/…` to `/shop/<slug>/…`, and the storefront's home shows the club's
 * page when the name is a club's. C2's own paths on that host (`/clubs/…`, a team store's `/t/…`) are left alone.
 * Locally, and anywhere the wildcard domain is not set up, `/shop/<slug>` is the same page by its path.
 */

/** The path every storefront page lives under. */
export const SHOP_PREFIX = "/shop";

/** A storefront's address in this app: `/shop/<slug>`, then the rest. */
export const shopPath = (slug: string, rest = ""): string => `${SHOP_PREFIX}/${slug}${rest === "" || rest === "/" ? "" : rest.startsWith("/") ? rest : `/${rest}`}`;

/** A slug: 3–40 lower-case letters, digits and single dashes, not reserved for Knitwright (the clubs' own rule). */
export const isSlug = (value: string): boolean => SLUG_PATTERN.test(value) && !value.includes("--") && !RESERVED_SUBDOMAINS.includes(value);

/** "Lahore Lions FC" → "lahore-lions-fc": a suggestion for the slug field. Never longer than 40. */
export function slugFrom(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `${base}-shop`.replace(/^-/, "");
}

/** The slug a host names under the root domain, or null. Ports are ignored. */
export function slugOfHost(host: string | null, root: string): string | null {
  if (!host) return null;
  const name = host.toLowerCase().replace(/:\d+$/, "");
  const suffix = `.${root.toLowerCase()}`;
  if (!name.endsWith(suffix)) return null;
  const sub = name.slice(0, -suffix.length);
  return isSlug(sub) ? sub : null;
}

/** Paths on a `<name>` host that are served as they are: the framework, the API, the shop itself and C2's pages. */
const AS_IS = ["/_next", "/api/", "/clubs/", "/t/"];

/** The host rule (`lib/hosts/rules.ts`): `<slug>.<root>/<path>` is `/shop/<slug>/<path>`, or null to leave it. */
export function brandHost(host: string, pathname: string, root: string): string | null {
  const slug = slugOfHost(host, root);
  if (slug === null) return null;
  if (pathname === SHOP_PREFIX || pathname.startsWith(`${SHOP_PREFIX}/`) || AS_IS.some((prefix) => pathname.startsWith(prefix))) return null;
  return shopPath(slug, pathname);
}

/** The public address of a storefront: its sub-domain where the root domain is set, its path everywhere else. */
export function storefrontUrl(slug: string, siteUrl: string, root: string | undefined): string {
  return root && root !== "localhost" ? `https://${slug}.${root}` : `${siteUrl.replace(/\/+$/, "")}${shopPath(slug)}`;
}

/** What the settings form shows after the slug field. */
export const domainSuffix = (root: string | undefined): string => (root && root !== "localhost" ? `.${root}` : " (at /shop/ until the domain is set up)");
