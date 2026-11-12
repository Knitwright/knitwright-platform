import type { Route } from "next";

/**
 * The places the dashboard shell offers (docs/spec/09-screen-map.md "Global shell", decision 0138).
 *
 * The rail holds the spec's items in the spec's order; the ⌄ group holds Orders, Store and Team
 * (Team for clubs only); ⋯ holds the v2.2 pages that have no rail item of their own yet, so none of
 * them loses its door while waves 2 to 4 move them into the v3.9 routes.
 *
 * Where a v2.2 page already serves a v3.9 route the item points at the v2.2 page, and the v3.9
 * address redirects to it (`redirects.ts`). Each place owns address prefixes, and the LONGEST
 * prefix across every list wins, so `/studio/charts` is Size charts rather than Projects.
 */

/** The Lucide glyph a place is drawn with. Mapped to the icon itself in `components/shell/icons.ts`. */
export type IconKey =
  | "sparkle"
  | "templates"
  | "shirt"
  | "megaphone"
  | "package"
  | "folder"
  | "truck"
  | "store"
  | "users"
  | "rocket"
  | "ruler"
  | "chart"
  | "pen"
  | "palette"
  | "coins"
  | "settings"
  | "swap"
  | "wand"
  | "layers"
  | "user-plus"
  | "help";

export interface ShellPlace {
  readonly id: string;
  readonly label: string;
  readonly href: Route;
  readonly icon: IconKey;
  /** Every address prefix that belongs to this place. */
  readonly owns: readonly string[];
}

/** What the shell knows about the workspace: whether it is a club, and whether its brand is set up. */
export interface Workspace {
  readonly isClub: boolean;
  readonly setUp: boolean;
}

/** The rail, under Create, in the order of `09`. */
export const RAIL: readonly ShellPlace[] = [
  { id: "ai-studio", label: "AI Studio", href: "/ai-studio", icon: "sparkle", owns: ["/ai-studio"] },
  { id: "templates", label: "Templates", href: "/templates", icon: "templates", owns: ["/templates"] },
  { id: "mockups", label: "Mockups", href: "/mockups", icon: "shirt", owns: ["/mockups"] },
  { id: "marketing", label: "Marketing", href: "/marketing", icon: "megaphone", owns: ["/marketing"] },
  // Products (plan v6 P4, decision 0142). `/catalogue` redirects here (lib/products/redirects.ts).
  { id: "products", label: "Products", href: "/products", icon: "package", owns: ["/products"] },
  // Projects (P1, decision 0139): its own pages, and the design editor under /studio.
  { id: "projects", label: "Projects", href: "/projects", icon: "folder", owns: ["/projects", "/studio"] },
];

const ORDERS: ShellPlace = { id: "orders", label: "Orders", href: "/orders", icon: "truck", owns: ["/orders"] };
const STORE: ShellPlace = { id: "store", label: "Store", href: "/store", icon: "store", owns: ["/store"] };
// Team (decision 0144): the roster, the committee's approvals and the seasons.
const TEAM: ShellPlace = { id: "team", label: "Team", href: "/team", icon: "users", owns: ["/team"] };

/** The ⌄ group: Orders, Store, and Team for a club workspace only. */
export const groupFor = (workspace: Workspace): readonly ShellPlace[] =>
  workspace.isClub ? [ORDERS, STORE, TEAM] : [ORDERS, STORE];

/** The v2.2 pages with no rail item yet. A brand that is not a club still reaches its club page here. */
export const moreFor = (workspace: Workspace): readonly ShellPlace[] => [
  { id: "launch", label: "Launch", href: "/launch", icon: "rocket", owns: ["/launch"] },
  { id: "teamwear", label: "Teamwear", href: "/teamwear", icon: "shirt", owns: ["/teamwear"] },
  { id: "charts", label: "Size charts", href: "/studio/charts", icon: "ruler", owns: ["/studio/charts"] },
  { id: "benchmarks", label: "Benchmarks", href: "/ai-studio/workflow/benchmark-products" as Route, icon: "chart", owns: ["/studio/benchmarks"] },
  { id: "designer", label: "Designer", href: "/designer", icon: "pen", owns: ["/designer"] },
  ...(workspace.isClub ? [] : [{ ...TEAM, id: "club", label: "Team and rosters" }]),
];

/** Where a place is drawn: on the rail, in the ⌄ group, or in ⋯. */
export type Placement = "rail" | "group" | "more";

export interface Located {
  readonly place: ShellPlace;
  readonly where: Placement;
}

const inside = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`);

const ownedLength = (place: ShellPlace, path: string): number =>
  Math.max(0, ...place.owns.filter((prefix) => inside(path, prefix)).map((prefix) => prefix.length));

/** Every place the shell draws for this workspace, with where it is drawn. */
export const placesFor = (workspace: Workspace): readonly Located[] => [
  ...RAIL.map((place) => ({ place, where: "rail" as const })),
  ...groupFor(workspace).map((place) => ({ place, where: "group" as const })),
  ...moreFor(workspace).map((place) => ({ place, where: "more" as const })),
];

/** The place this address belongs to, or null. The longest owned prefix wins. */
export const locate = (path: string, workspace: Workspace): Located | null => {
  let found: Located | null = null;
  let best = 0;
  for (const located of placesFor(workspace)) {
    const length = ownedLength(located.place, path);
    if (length > best) {
      found = located;
      best = length;
    }
  }
  return found;
};

/** The id of the current place, or null. */
export const currentId = (path: string, workspace: Workspace): string | null => locate(path, workspace)?.place.id ?? null;

/** True when the ⌄ group should start open: the current page is inside it. */
export const groupStartsOpen = (path: string, workspace: Workspace): boolean => locate(path, workspace)?.where === "group";

/** True when ⋯ should read as current: the current page is one of its own. */
export const moreIsCurrent = (path: string, workspace: Workspace): boolean => locate(path, workspace)?.where === "more";

/** True when the brand pill is the current place: the Brand page and the brand switcher are its pages. */
export const brandIsCurrent = (path: string): boolean => ["/brand", "/brands"].some((prefix) => inside(path, prefix));
