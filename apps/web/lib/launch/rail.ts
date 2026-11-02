import type { LaunchPanelId } from "./panels";

/**
 * The left icon rail of the launch shell (spec Launch shell, "Left icon rail"): Templates, Text,
 * Elements, AI Image, Mockups, Photos, Pattern fills, Likes, Uploads, Brand, AI assistant, Layers.
 *
 * The spec's rail also has an **Apps** icon for Shopify and Etsy. It is deliberately not here:
 * owner decision 1 keeps the Store out of this platform, and an icon that opened nothing would be
 * a promise the platform does not keep. Decision 0091 records that.
 *
 * A tab list, like the editor's tool rail: the arrow keys move between panels and open each one,
 * Home and End jump to the ends, and Tab moves on into the open panel.
 */

export const RAIL_ITEMS = [
  "templates",
  "text",
  "elements",
  "ai-image",
  "mockups",
  "photos",
  "pattern-fills",
  "likes",
  "uploads",
  "brand",
  "assistant",
  "layers",
  // `satisfies` is the compile-time proof that every rail item is a panel of the contract, so the
  // shell can always draw a labelled placeholder for one that is not built yet.
] as const satisfies readonly LaunchPanelId[];

export type RailId = (typeof RAIL_ITEMS)[number];

interface RailItemInfo {
  readonly id: RailId;
  /** The word under the icon. The spec's Settings can hide these labels; the shell always keeps them. */
  readonly label: string;
}

export const RAIL: Readonly<Record<RailId, RailItemInfo>> = {
  templates: { id: "templates", label: "Templates" },
  text: { id: "text", label: "Text" },
  elements: { id: "elements", label: "Elements" },
  "ai-image": { id: "ai-image", label: "AI image" },
  mockups: { id: "mockups", label: "Mockups" },
  photos: { id: "photos", label: "Photos" },
  "pattern-fills": { id: "pattern-fills", label: "Pattern fills" },
  likes: { id: "likes", label: "Likes" },
  uploads: { id: "uploads", label: "Uploads" },
  brand: { id: "brand", label: "Brand" },
  assistant: { id: "assistant", label: "AI assistant" },
  layers: { id: "layers", label: "Layers" },
};

export const DEFAULT_RAIL_ITEM: RailId = "templates";

const isRailItem = (value: string): value is RailId => (RAIL_ITEMS as readonly string[]).includes(value);

/** The rail panel an address names, or Templates. A name given twice counts once. */
export function parseRail(value: string | readonly string[] | null | undefined): RailId {
  const first = typeof value === "string" ? value : value?.[0];
  return first && isRailItem(first) ? first : DEFAULT_RAIL_ITEM;
}

export const railTabId = (id: RailId): string => `launch-rail-tab-${id}`;
export const railPanelId = (id: RailId): string => `launch-rail-panel-${id}`;

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREVIOUS_KEYS = new Set(["ArrowUp", "ArrowLeft"]);

/** The rail panel a key moves to: arrows step and wrap, Home and End jump to the ends. */
export function railKeyTarget(current: RailId, key: string): RailId | null {
  const last = RAIL_ITEMS.length - 1;
  const at = RAIL_ITEMS.indexOf(current);
  if (key === "Home") return RAIL_ITEMS[0];
  if (key === "End") return RAIL_ITEMS[last] as RailId;
  if (NEXT_KEYS.has(key)) return RAIL_ITEMS[at < 0 || at === last ? 0 : at + 1] as RailId;
  if (PREVIOUS_KEYS.has(key)) return RAIL_ITEMS[at <= 0 ? last : at - 1] as RailId;
  return null;
}
