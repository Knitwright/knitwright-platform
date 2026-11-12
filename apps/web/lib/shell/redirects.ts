/**
 * The v3.9 addresses a v2.2 page already serves, and the one address that changed hands
 * (decision 0138). They are temporary (307): each wave-2 workstream builds its page at the v3.9
 * address and deletes its line here, and a permanent redirect would stay in browsers' caches after.
 *
 * A v2.2 page a workstream has MOVED to its v3.9 address answers its old address with a permanent
 * redirect (308, plan v6 "a moved screen keeps its behaviour"): the old address is gone for good,
 * and its query (a tab, say) is carried across.
 */
export interface Alias {
  readonly source: string;
  readonly destination: string;
  readonly permanent: boolean;
}

const moved = (source: string, destination: string): Alias => ({ source, destination, permanent: true });

export const ROUTE_ALIASES: readonly Alias[] = [
  // P6 (decision 0144): the club page and Collect are Team; Brand Studio is Brand.
  moved("/club", "/team"),
  moved("/collect", "/team?tab=approvals"),
  moved("/brand-studio", "/brand"),
  moved("/brand-studio/import", "/brand/import"),
];

/**
 * A v2.2 page that a wave-2 workstream has moved into its v3.9 home, for good (308). The old address
 * keeps working, with its query, and every link to it lands on the new page.
 */
export interface Moved {
  readonly source: string;
  readonly destination: string;
  readonly permanent: true;
}

export const MOVED_PAGES: readonly Moved[] = [
  // P1 (decision 0139): the studio home is Recent on the Projects page.
  { source: "/studio", destination: "/projects/recent", permanent: true },
];
