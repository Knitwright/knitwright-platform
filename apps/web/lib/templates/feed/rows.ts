import type { MarketingGroup } from "@/lib/marketing/templates/types";
import { matchesWords, type FeedItem, type FeedKind } from "./items";
import { isSportTab, TEMPLATE_TAB_LABELS, type SportTab, type TemplateTab } from "./tabs";

/**
 * What the Templates page shows for one tab and one search (09 screen 7, decision 0140).
 *
 * Discover is a stack of rows, each a carousel of cards with a count and a "›" to the tab that
 * holds the rest. Every other tab, and any search, is one grid.
 *
 * `09` lists a "Trending" row. Nothing records how often a template is used across brands yet, so
 * a trending order would be invented; the row is left out until that count exists (decision 0140,
 * owner question).
 */

/** How many cards one carousel row holds before its "›" link. */
export const ROW_LIMIT = 12;

export interface FeedRow {
  readonly id: string;
  readonly title: string;
  readonly items: readonly FeedItem[];
  /** Everything that would match, of which `items` is the first `ROW_LIMIT`. */
  readonly total: number;
  /** The tab with the rest, or null. */
  readonly more: TemplateTab | null;
}

export type FeedView =
  | Readonly<{ layout: "rows"; rows: readonly FeedRow[] }>
  | Readonly<{ layout: "grid"; title: string; items: readonly FeedItem[] }>;

const ofKind = (items: readonly FeedItem[], kind: FeedKind): readonly FeedItem[] => items.filter((item) => item.kind === kind);
const ofGroup = (items: readonly FeedItem[], group: MarketingGroup): readonly FeedItem[] => items.filter((item) => item.group === group);
const ofSport = (items: readonly FeedItem[], sport: SportTab): readonly FeedItem[] => items.filter((item) => item.kind === "design" && item.sports.includes(sport));

/** A few designs from different sports first, then the rest, in the library's fixed order. */
export function forYou(designs: readonly FeedItem[]): readonly FeedItem[] {
  const leads = designs.filter((item, at) => designs.findIndex((other) => other.sports[0] === item.sports[0]) === at);
  return [...leads, ...designs.filter((item) => !leads.includes(item))];
}

const row = (id: string, title: string, items: readonly FeedItem[], more: TemplateTab | null): FeedRow => ({
  id,
  title,
  items: items.slice(0, ROW_LIMIT),
  total: items.length,
  more,
});

/** The size-chart layouts are the social layouts whose key names a size. */
const sizeCharts = (items: readonly FeedItem[]): readonly FeedItem[] => items.filter((item) => item.layoutKey?.includes("size") ?? false);

/** The Discover rows, in the order `09` lists them, leaving out any row with nothing in it. */
export function discoverRows(items: readonly FeedItem[]): readonly FeedRow[] {
  const designs = ofKind(items, "design");
  const social = ofKind(items, "social");
  return [
    row("for-you", "For you", forYou(designs), null),
    row("launch-packs", "Kit launch packs", ofKind(items, "pack"), "launch-packs"),
    row("team-store", "Team store promos", ofGroup(social, "team-store"), "social"),
    row("videos", "Videos", ofKind(items, "video"), "videos"),
    row("matchday", "Matchday graphics", ofGroup(social, "club-life"), "social"),
    row("size-charts", "Size charts", sizeCharts(social), "social"),
    row("football", "Football kits", ofSport(items, "football"), "football"),
    row("cricket", "Cricket kits", ofSport(items, "cricket"), "cricket"),
    row("training", "Training wear", ofSport(items, "training"), "training"),
    row("tech-packs", "Tech packs", ofKind(items, "techpack"), "tech-packs"),
  ].filter((entry) => entry.total > 0);
}

const KIND_OF_TAB: Partial<Readonly<Record<TemplateTab, FeedKind>>> = {
  "launch-packs": "pack",
  social: "social",
  videos: "video",
  "tech-packs": "techpack",
};

/** Everything one tab holds, before any search. */
export function itemsOfTab(items: readonly FeedItem[], tab: TemplateTab): readonly FeedItem[] {
  if (isSportTab(tab)) return ofSport(items, tab);
  const kind = KIND_OF_TAB[tab];
  return kind === undefined ? items : ofKind(items, kind);
}

/** The page for one tab and one search. A search always shows a grid, in the tab it was typed on. */
export function feedView(items: readonly FeedItem[], tab: TemplateTab, search: string): FeedView {
  if (tab === "discover" && search === "") return { layout: "rows", rows: discoverRows(items) };
  const found = itemsOfTab(items, tab).filter((item) => matchesWords(item, search));
  const title = search === "" ? TEMPLATE_TAB_LABELS[tab] : `Results for "${search}"`;
  return { layout: "grid", title, items: found };
}

/**
 * The older filter address (`?sport=&article=&style=&colour=`), which other pages and tests link
 * to: the designs those filters keep, as one grid, still narrowed by any search.
 */
export function filteredView(items: readonly FeedItem[], keep: ReadonlySet<string>, search: string): FeedView {
  const found = items.filter((item) => item.kind === "design" && keep.has(item.id) && matchesWords(item, search));
  return { layout: "grid", title: "Filtered templates", items: found };
}

/** The view with each of its items swapped for the same item from `drawn`, which carries its picture. */
export function withDrawn(view: FeedView, drawn: readonly FeedItem[]): FeedView {
  const byId = new Map(drawn.map((item) => [item.id, item]));
  const swap = (items: readonly FeedItem[]) => items.map((item) => byId.get(item.id) ?? item);
  return view.layout === "rows" ? { layout: "rows", rows: view.rows.map((entry) => ({ ...entry, items: swap(entry.items) })) } : { ...view, items: swap(view.items) };
}

/** The designs a view shows, so only those are drawn. */
export function shownDesignIds(view: FeedView): readonly string[] {
  const items = view.layout === "rows" ? view.rows.flatMap((entry) => entry.items) : view.items;
  return [...new Set(items.filter((item) => item.kind === "design").map((item) => item.id))];
}
