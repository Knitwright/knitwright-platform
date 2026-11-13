import { brandHost } from "@/lib/storefront/host";
import { clubHost } from "@/lib/team-stores/host";

/**
 * SUBDOMAIN ROUTING (plan v6 wave 5, decisions 0153 and 0154): which page a `<name>.knitwright.com` address shows.
 * `proxy.ts` asks each rule in turn and rewrites to the first answer. One rule per line, each in its owner's own
 * file, so the workstreams that add one (C2 clubs, C3 brand storefronts) never edit the same line. This is the only
 * place host rules live: `proxy.ts` calls `rewriteForHost` and knows no host itself. All rules share one root
 * domain (`CLUB_PAGES_DOMAIN`, e.g. knitwright.com) and one namespace of names, so a rule that claims a name must
 * also check no other rule's table holds it (clubs: `club_pages.slug`, `private.reserved_subdomain`).
 */

export type HostRule = (host: string, pathname: string, rootDomain: string) => string | null;

export const HOST_RULES: readonly HostRule[] = [
  // Decision 0154: brands and clubs share the names, so this claims every one; a club's name shows the club page.
  brandHost,
  clubHost,
];

/** The internal path a request on another host is rewritten to, or null to serve it as it is. */
export function rewriteForHost(host: string | null, pathname: string, rootDomain: string | undefined): string | null {
  if (!host || !rootDomain) return null;
  for (const rule of HOST_RULES) {
    const target = rule(host, pathname, rootDomain);
    if (target !== null) return target;
  }
  return null;
}
