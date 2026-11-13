/**
 * BRAND STOREFRONT ADDRESSES (plan v6 C3, decision 0154; spec F-L5 "`<brand>.knitwright.com`").
 *
 * A storefront lives at `<slug>.<root>` (root `knitwright.com` unless STOREFRONT_ROOT_DOMAIN says otherwise). The
 * proxy rewrites such a request to `/shop/<slug>/…`, so the pages are ordinary routes; locally, and anywhere a
 * wildcard domain is not set up, `/shop/<slug>` is the same page by its path. This file is the brand host rule
 * and nothing else: C2's club host rule sits in its own file beside it, and the proxy names each in one line.
 */

export const DEFAULT_ROOT_DOMAIN = "knitwright.com";

/** The path every storefront page lives under. */
export const SHOP_PREFIX = "/shop";

/** A storefront's address in this app: `/shop/<slug>`, then the rest. */
export const shopPath = (slug: string, rest = ""): string => `${SHOP_PREFIX}/${slug}${rest === "" || rest === "/" ? "" : rest.startsWith("/") ? rest : `/${rest}`}`;

/** A slug: 3–40 lower-case letters, digits and dashes, not starting or ending with a dash. */
export const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Sub-domains a brand can never take, because Knitwright itself answers on them (or will). C2's club pages use the
 * same namespace; a slug is checked against the other side's table when it is saved (`storefront/slug.ts`).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www", "app", "api", "admin", "ops", "store", "shop", "help", "docs", "status", "mail", "static", "assets",
  "cdn", "dev", "staging", "preview", "auth", "login", "signin", "signup", "billing", "checkout", "pay",
  "knitwright", "support", "blog", "club", "clubs", "team", "teams",
]);

export const isSlug = (value: string): boolean => SLUG.test(value) && !value.includes("--") && !RESERVED_SLUGS.has(value);

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

/** The slug a host names, or null when the host is not a brand storefront's. Ports are ignored. */
export function slugOfHost(host: string | null, root: string = DEFAULT_ROOT_DOMAIN): string | null {
  if (!host) return null;
  const name = host.toLowerCase().replace(/:\d+$/, "");
  const suffix = `.${root.toLowerCase()}`;
  if (!name.endsWith(suffix)) return null;
  const sub = name.slice(0, -suffix.length);
  return isSlug(sub) ? sub : null;
}

/**
 * The brand host rule, for the proxy: the path to rewrite `<slug>.<root>/<path>` to, or null to leave the request
 * alone. Next.js's own files and the API are never rewritten, and a path already under `/shop` is left as it is.
 */
export function brandHostRewrite(host: string | null, pathname: string, root: string = DEFAULT_ROOT_DOMAIN): string | null {
  const slug = slugOfHost(host, root);
  if (slug === null) return null;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === SHOP_PREFIX || pathname.startsWith(`${SHOP_PREFIX}/`)) return null;
  return shopPath(slug, pathname);
}

/** The public address of a storefront: its sub-domain on a deploy, its path everywhere else. */
export function storefrontUrl(slug: string, siteUrl: string, root: string = DEFAULT_ROOT_DOMAIN): string {
  const site = new URL(siteUrl);
  const onRoot = site.hostname === root || site.hostname.endsWith(`.${root}`);
  return onRoot ? `https://${slug}.${root}` : new URL(shopPath(slug), site).toString().replace(/\/$/, "");
}
