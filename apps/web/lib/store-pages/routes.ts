import type { Route } from "next";

/**
 * The seller's Store (plan v6 C5, decision 0156; `docs/spec/09-screen-map.md` screens 16, 24 and 25): five tabs,
 * one page each, under the page title.
 */

export const STORE_PATH = "/store";
export const CHANNELS_PATH = "/store/channels";
export const BRANDING_PATH = "/store/branding";
export const SETTINGS_PATH = "/store/settings";
export const PAYOUTS_PATH = "/store/payouts";

export const STORE_TABS = [
  { href: STORE_PATH, label: "Overview" },
  { href: CHANNELS_PATH, label: "Sales channels" },
  { href: BRANDING_PATH, label: "Branding" },
  { href: SETTINGS_PATH, label: "Settings" },
  { href: PAYOUTS_PATH, label: "Payouts" },
] as const satisfies readonly Readonly<{ href: Route; label: string }>[];

export type StoreTab = (typeof STORE_TABS)[number]["href"];

/**
 * Doors into other Store workstreams' screens. Each is one line its owner sets when its screen merges: C3 the
 * storefront editor and the new-drop flow, C2 team stores. Null means the screen is not built yet, and the page
 * says so instead of linking nowhere.
 */
export const STOREFRONT_EDITOR_HREF: Route | null = null;
export const NEW_DROP_HREF: Route | null = null;
export const TEAM_STORES_HREF: Route | null = "/team?tab=stores" as Route;
