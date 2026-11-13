import type { RailId } from "@/lib/launch";

/**
 * THE EDITOR'S LABELLED RAIL (plan v6 E2, decision 0146; `09` screen 12, prototype e01 and e03–e14).
 *
 * Eleven items, top to bottom, as the founder's screenshots of the real editor have them:
 *
 *   Products · Templates · Text · Illustrations · AI Gallery · Mockups · Uploads |
 *   More · Learn · Layers · Help
 *
 * Each opens a 320 px flyout beside the rail; pressing the open one again closes it. Most of them
 * are a panel the launch shell already had (`lib/launch/rail.ts`, the L-workstreams' panels): the
 * rail renames them to the screen map's words and mounts the same component, so nothing built is
 * lost. Five are the editor's own -- Products, More, Learn, Layers and Help -- and **More** is the
 * door to the six launch panels the new rail has no icon for: Photos, Chat (the AI assistant),
 * Likes, Brand, Textures (pattern fills) and Team.
 *
 * Which flyout is open is the editor's own state, kept apart from the launch shell's `panel` so the
 * panel contract (decision 0091) does not change: a flyout that *is* a launch panel opens that panel
 * through the shell, and the address keeps saying `?panel=<id>` as it always did.
 */

/** The editor's own flyouts, which are not panels of the launch contract. */
export const OWN_FLYOUTS = ["products", "more", "learn", "layers", "help"] as const;
export type OwnFlyout = (typeof OWN_FLYOUTS)[number];

/** What the flyout beside the rail shows: one of the editor's own, a launch panel, or nothing. */
export type Flyout = Readonly<{ kind: "own"; id: OwnFlyout }> | Readonly<{ kind: "panel"; id: RailId }> | Readonly<{ kind: "closed" }>;

export const CLOSED: Flyout = { kind: "closed" };

/** The rail's items, in order. `group` is where the hairline falls: after Uploads, and Help sits at the bottom. */
export const RAIL_ENTRIES = [
  { id: "products", label: "Products", opens: { kind: "own", id: "products" }, group: "make" },
  { id: "templates", label: "Templates", opens: { kind: "panel", id: "templates" }, group: "make" },
  { id: "text", label: "Text", opens: { kind: "panel", id: "text" }, group: "make" },
  { id: "illustrations", label: "Illustrations", opens: { kind: "panel", id: "elements" }, group: "make" },
  { id: "gallery", label: "AI Gallery", opens: { kind: "panel", id: "ai-image" }, group: "make" },
  { id: "mockups", label: "Mockups", opens: { kind: "panel", id: "mockups" }, group: "make" },
  { id: "uploads", label: "Uploads", opens: { kind: "panel", id: "uploads" }, group: "make" },
  { id: "more", label: "More", opens: { kind: "own", id: "more" }, group: "find" },
  { id: "learn", label: "Learn", opens: { kind: "own", id: "learn" }, group: "find" },
  { id: "layers", label: "Layers", opens: { kind: "own", id: "layers" }, group: "find" },
  { id: "help", label: "Help", opens: { kind: "own", id: "help" }, group: "foot" },
] as const satisfies readonly Readonly<{ id: string; label: string; opens: Flyout; group: "make" | "find" | "foot" }>[];

export type RailEntry = (typeof RAIL_ENTRIES)[number];
export type RailEntryId = RailEntry["id"];

/**
 * The apps More lists (prototype e10, "Your apps"). Each opens a launch panel in the flyout, with a
 * way back to More, except Team, which is a page of its own (decision 0144). The screen map's other
 * apps -- Pinterest, Bulk mockups, Shopify, QR code, Names and numbers -- are not built, and an app
 * that opened nothing would be a promise the editor does not keep, so they are not listed.
 */
export const MORE_APPS = [
  { id: "photos", label: "Photos", line: "Your own photographs and the golden-sample photos", opens: { kind: "panel", id: "photos" } },
  { id: "chat", label: "Chat", line: "Write with the assistant, in your brand's voice", opens: { kind: "panel", id: "assistant" } },
  { id: "likes", label: "Likes", line: "Templates, scenes and graphics you liked", opens: { kind: "panel", id: "likes" } },
  { id: "brand", label: "Brand", line: "Keep your designs on-brand", opens: { kind: "panel", id: "brand" } },
  { id: "textures", label: "Textures", line: "Repeat prints as fills: stripes, hoops, mesh", opens: { kind: "panel", id: "pattern-fills" } },
  { id: "team", label: "Team", line: "Roster, names and numbers", href: "/team" },
] as const satisfies readonly Readonly<{ id: string; label: string; line: string; opens?: Flyout; href?: string }>[];

export type MoreApp = (typeof MORE_APPS)[number];

const sameFlyout = (a: Flyout, b: Flyout): boolean =>
  a.kind === b.kind && (a.kind === "closed" || (a as { id: string }).id === (b as { id: string }).id);

/** The rail item a flyout lights up: its own item, or More for a panel only More opens. Null when closed. */
export function entryFor(flyout: Flyout): RailEntryId | null {
  if (flyout.kind === "closed") return null;
  const direct = RAIL_ENTRIES.find((entry) => sameFlyout(entry.opens, flyout));
  if (direct) return direct.id;
  return MORE_APPS.some((app) => "opens" in app && sameFlyout(app.opens, flyout)) ? "more" : null;
}

/** True when the flyout is a launch panel reached through More, so its header offers a way back. */
export const isMoreApp = (flyout: Flyout): boolean => flyout.kind === "panel" && entryFor(flyout) === "more";

/** What pressing a rail item does: open its flyout, or close it when it is the one already lit. */
export function pressed(current: Flyout, entry: RailEntryId): Flyout {
  const target = RAIL_ENTRIES.find((one) => one.id === entry);
  if (!target) return current;
  return entryFor(current) === entry ? CLOSED : target.opens;
}

/** The title over a flyout: the rail's word for it, or the More app's name. */
export function flyoutTitle(flyout: Flyout): string {
  if (flyout.kind === "closed") return "";
  const app = MORE_APPS.find((one) => "opens" in one && sameFlyout(one.opens, flyout));
  if (app) return app.label;
  return RAIL_ENTRIES.find((entry) => sameFlyout(entry.opens, flyout))?.label ?? "";
}

const NEXT = new Set(["ArrowDown", "ArrowRight"]);
const PREVIOUS = new Set(["ArrowUp", "ArrowLeft"]);

/** The rail item a key moves focus to: arrows step and wrap, Home and End jump. Null for any other key. */
export function railMove(current: RailEntryId, key: string): RailEntryId | null {
  const ids = RAIL_ENTRIES.map((entry) => entry.id);
  const at = ids.indexOf(current);
  const last = ids.length - 1;
  if (key === "Home") return ids[0] as RailEntryId;
  if (key === "End") return ids[last] as RailEntryId;
  if (NEXT.has(key)) return ids[at === last ? 0 : at + 1] as RailEntryId;
  if (PREVIOUS.has(key)) return ids[at <= 0 ? last : at - 1] as RailEntryId;
  return null;
}

const OWN = new Set<string>(OWN_FLYOUTS);
const PANELS = new Set<string>(RAIL_ENTRIES.flatMap((entry) => (entry.opens.kind === "panel" ? [entry.opens.id] : [])).concat(MORE_APPS.flatMap((app) => ("opens" in app ? [app.opens.id] : []))));

const firstOf = (value: string | readonly string[] | undefined): string | undefined => (typeof value === "string" ? value : value?.[0]);

/**
 * The flyout an address opens with. `?fly=<own id>` or `?fly=none` names it outright; otherwise a
 * `?panel=<launch panel>` the address carries opens that panel, so every link the launch shell ever
 * wrote still lands on its panel; and a plain address opens Products, as the editor does.
 */
export function readFlyout(query: Readonly<Record<string, string | readonly string[] | undefined>>): Flyout {
  const fly = firstOf(query["fly"]);
  if (fly === "none") return CLOSED;
  if (fly !== undefined && OWN.has(fly)) return { kind: "own", id: fly as OwnFlyout };
  const panel = firstOf(query["panel"]);
  if (panel !== undefined && PANELS.has(panel)) return { kind: "panel", id: panel as RailId };
  return { kind: "own", id: "products" };
}

export const railTab = (id: RailEntryId): string => `editor-rail-${id}`;
export const FLYOUT_ID = "editor-flyout";
