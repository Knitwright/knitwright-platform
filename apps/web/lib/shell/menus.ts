import type { Route } from "next";
import type { IconKey } from "./nav";

/**
 * The entries of the shell's menus (decision 0138).
 *
 * The Create menu lists `09` screen 1's items that have something behind them today. An item with
 * nothing behind it yet (Video, Mockup, Tech pack, Import design) is left out rather than shown dead:
 * a tech pack and an imported design both need a design first, and are reached from inside one.
 */

export interface MenuLink {
  readonly id: string;
  readonly label: string;
  readonly href: Route;
  readonly icon: IconKey;
}

export const CREATE_ITEMS: readonly MenuLink[] = [
  // Templates first, then a blank garment: the guided start (decision 0074's create-new flow).
  { id: "kit-design", label: "New kit design", href: "/studio/start", icon: "shirt" },
  { id: "crest", label: "Kit from crest", href: "/ai-studio/workflow/crest-to-kit" as Route, icon: "wand" },
  // A launch canvas is where social posts, mockups, scenes and clips are made today.
  { id: "social", label: "Social post", href: "/launch", icon: "megaphone" },
  { id: "templates", label: "Explore templates", href: "/templates", icon: "templates" },
  { id: "blank", label: "Blank canvas", href: "/studio/new", icon: "layers" },
];

/** ⊕ in the top bar: invite people, or add credits. Members and roles are on the club page today. */
export const ADD_ITEMS: readonly MenuLink[] = [
  { id: "invite", label: "Invite people", href: "/club#members" as Route, icon: "user-plus" },
  { id: "credits", label: "Add credits", href: "/credits", icon: "coins" },
];

/** The top bar's avatar: decision 0103's account menu (the address, Settings, then Sign out). */
export const ACCOUNT_ITEMS: readonly MenuLink[] = [{ id: "settings", label: "Settings", href: "/settings", icon: "settings" }];

/** The rail's square avatar is the workspace: its Brand Studio, the brand switcher and its credits. */
export const WORKSPACE_ITEMS: readonly MenuLink[] = [
  { id: "brand-studio", label: "Brand Studio", href: "/brand-studio", icon: "palette" },
  { id: "brands", label: "Switch brand", href: "/brands", icon: "swap" },
  { id: "credits", label: "Credits", href: "/credits", icon: "coins" },
];

/** Where Help and the help bubble go until there is a help centre: a message to the team. */
export const helpHref = (contactEmail: string): string => `mailto:${contactEmail}?subject=${encodeURIComponent("Help with Knitwright")}`;

/** The avatar's initial: the first letter of the address, or a neutral mark when there is none. */
export const initialOf = (email: string | null): string => {
  const first = email?.trim().charAt(0) ?? "";
  return /[a-z0-9]/i.test(first) ? first.toUpperCase() : "?";
};
