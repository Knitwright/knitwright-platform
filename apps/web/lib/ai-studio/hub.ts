import { CATEGORY_LABELS, WORKFLOW_CATEGORIES, WORKFLOWS, type Workflow, type WorkflowCategory } from "./catalogue";

/**
 * The AI Workflows hub (`09` screen 3): its tabs, its rows and its search, as plain data so the
 * screen holds markup only and every filter is tested without a browser.
 */

export const HUB_TABS = ["discover", "for-you", "2027-kits", "teamwear", "ads", "ugc", "product-scenes"] as const;
export type HubTab = (typeof HUB_TABS)[number];

export const HUB_TAB_LABELS: Readonly<Record<HubTab, string>> = {
  discover: "Discover",
  "for-you": "For you",
  "2027-kits": "2027 kits",
  teamwear: "Teamwear",
  ads: "Ads",
  ugc: "UGC",
  "product-scenes": "Product scenes",
};

/** The categories each tab shows. Discover shows every row. */
const TAB_CATEGORIES: Readonly<Record<HubTab, readonly WorkflowCategory[]>> = {
  discover: WORKFLOW_CATEGORIES,
  "for-you": [],
  "2027-kits": ["kit-design", "mockups"],
  teamwear: ["kit-design", "team-club", "branding"],
  ads: ["ads"],
  ugc: ["ugc"],
  "product-scenes": ["product-scenes", "product-listings"],
};

/**
 * The "For you" row: the four workflows the spec names first (F-T2, F-L2, F-L1, F-S2). A labelled
 * default, the same for every brand, until there is a signal to choose by (owner question, 0141).
 */
export const FOR_YOU: readonly string[] = ["crest-to-kit", "kit-launch-ad", "on-model-try-on", "benchmark-products"];

export interface HubRow {
  readonly id: string;
  readonly title: string;
  readonly workflows: readonly Workflow[];
}

export const isHubTab = (value: unknown): value is HubTab => typeof value === "string" && (HUB_TABS as readonly string[]).includes(value);

const forYouRow = (): HubRow => ({
  id: "for-you",
  title: "For you",
  workflows: FOR_YOU.flatMap((id) => WORKFLOWS.filter((one) => one.id === id)),
});

const categoryRow = (category: WorkflowCategory): HubRow => ({
  id: category,
  title: CATEGORY_LABELS[category],
  workflows: WORKFLOWS.filter((one) => one.category === category),
});

const matches = (workflow: Workflow, words: string): boolean =>
  `${workflow.title} ${workflow.lead} ${CATEGORY_LABELS[workflow.category]}`.toLowerCase().includes(words);

/** The rows a tab shows, narrowed by the search words. A row with nothing left in it is left out. */
export function hubRows(tab: HubTab, search = ""): readonly HubRow[] {
  const words = search.trim().toLowerCase();
  const rows = tab === "for-you" ? [forYouRow()] : [...(tab === "discover" ? [forYouRow()] : []), ...TAB_CATEGORIES[tab].map(categoryRow)];
  return rows
    .map((row) => ({ ...row, workflows: words === "" ? row.workflows : row.workflows.filter((one) => matches(one, words)) }))
    .filter((row) => row.workflows.length > 0);
}

/** "View all" on a row: the category's whole list, or null for For you, which has no more. */
export const viewAllOf = (rowId: string): WorkflowCategory | null =>
  (WORKFLOW_CATEGORIES as readonly string[]).includes(rowId) ? (rowId as WorkflowCategory) : null;
