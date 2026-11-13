import { clubHost } from "@/lib/team-stores/host";

/**
 * SUBDOMAIN ROUTING (plan v6 wave 5, decisions 0153 and 0154): which page a `<name>.knitwright.com` address shows.
 * `proxy.ts` asks each rule in turn and rewrites to the first answer. One rule per line, each in its owner's own
 * file, so the workstreams that add one (C2 clubs, C3 brand storefronts) never edit the same line.
 */

export type HostRule = (host: string, pathname: string, rootDomain: string) => string | null;

export const HOST_RULES: readonly HostRule[] = [
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
