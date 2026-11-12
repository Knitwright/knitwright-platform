/**
 * The v3.9 addresses a v2.2 page already serves, and the one address that changed hands
 * (decision 0138). They are temporary (307): each wave-2 workstream builds its page at the v3.9
 * address and deletes its line here, and a permanent redirect would stay in browsers' caches after.
 *
 * `/brand` was the product-runs page. Runs now live at `/orders/runs`, and `/brand` is Brand Studio
 * until P6 builds the v3.9 Brand page there.
 */
export interface Alias {
  readonly source: string;
  readonly destination: string;
  readonly permanent: false;
}

const alias = (source: string, destination: string): Alias => ({ source, destination, permanent: false });

export const ROUTE_ALIASES: readonly Alias[] = [
  alias("/projects", "/studio"),
  alias("/products", "/catalogue"),
  alias("/products/:code", "/catalogue/:code"),
  alias("/team", "/club"),
  alias("/brand", "/brand-studio"),
];

/**
 * Screens a v3.9 workstream MOVED for good (308): the old address keeps working for a bookmark, and
 * the screen, its actions and its tests live at the new one. One line per move, owned by the mover.
 */
export interface Move {
  readonly source: string;
  readonly destination: string;
  readonly permanent: true;
}

const move = (source: string, destination: string): Move => ({ source, destination, permanent: true });

export const MOVED_ROUTES: readonly Move[] = [
  // P3 AI Studio (decision 0141): crest to kit and the benchmarks list are workflow pages now.
  move("/crest-to-kit", "/ai-studio/workflow/crest-to-kit"),
  move("/studio/benchmarks", "/ai-studio/workflow/benchmark-products"),
];
