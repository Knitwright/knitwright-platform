/**
 * The tabs of the v3.9 Templates page (09 screen 7, decision 0140): Discover, seven sports, then
 * the four kinds that are not a garment design. A tab is part of the address (`?tab=`), so a link
 * or a reload opens the same tab.
 *
 * A sport tab narrows the DESIGN templates by Knitwright's own sport tags (`07`'s launch tag set,
 * `lib/templates/kinds/tags.ts`) and by the older `sport` column. "Running" and "Gym" share `07`'s
 * one "running-gym" group: the tag set has no finer split, and this page does not invent one.
 */

export const TEMPLATE_TABS = [
  "discover",
  "football",
  "cricket",
  "training",
  "running",
  "gym",
  "combat",
  "esports",
  "launch-packs",
  "social",
  "videos",
  "tech-packs",
] as const;
export type TemplateTab = (typeof TEMPLATE_TABS)[number];

export const TEMPLATE_TAB_LABELS: Readonly<Record<TemplateTab, string>> = {
  discover: "Discover",
  football: "Football",
  cricket: "Cricket",
  training: "Training",
  running: "Running",
  gym: "Gym",
  combat: "Combat",
  esports: "Esports",
  "launch-packs": "Launch packs",
  social: "Social",
  videos: "Videos",
  "tech-packs": "Tech packs",
};

/** The seven sport tabs, in the order the page shows them. */
export const SPORT_TABS = ["football", "cricket", "training", "running", "gym", "combat", "esports"] as const satisfies readonly TemplateTab[];
export type SportTab = (typeof SPORT_TABS)[number];

export const isSportTab = (tab: TemplateTab): tab is SportTab => (SPORT_TABS as readonly string[]).includes(tab);

/** The sport tabs a design belongs to, from its `07` sport tags and its own `sport` column. */
export function sportTabsOf(sportTags: readonly string[], sport: string): readonly SportTab[] {
  const given = new Set([...sportTags, sport]);
  const tabs = new Set<SportTab>();
  if (given.has("football")) tabs.add("football");
  if (given.has("cricket")) tabs.add("cricket");
  if (given.has("training")) tabs.add("training");
  if (given.has("running")) tabs.add("running");
  if (given.has("running-gym")) {
    tabs.add("running");
    tabs.add("gym");
  }
  if (given.has("combat")) tabs.add("combat");
  if (given.has("esports")) tabs.add("esports");
  return SPORT_TABS.filter((tab) => tabs.has(tab));
}

type SearchValue = string | string[] | undefined;
const first = (value: SearchValue): string | undefined => (Array.isArray(value) ? value[0] : value);

/** The tab an address names, or Discover. */
export function tabFromQuery(value: SearchValue): TemplateTab {
  const raw = first(value);
  return TEMPLATE_TABS.find((tab) => tab === raw) ?? "discover";
}

/** The words typed into the search, trimmed and held to a sane length. */
export function searchFromQuery(value: SearchValue): string {
  return (first(value) ?? "").trim().slice(0, 80);
}

/** The address of one tab, keeping the search when there is one. */
export function tabHref(tab: TemplateTab, search = ""): string {
  const query = new URLSearchParams();
  if (tab !== "discover") query.set("tab", tab);
  if (search !== "") query.set("q", search);
  const text = query.toString();
  return text ? `/templates?${text}` : "/templates";
}
