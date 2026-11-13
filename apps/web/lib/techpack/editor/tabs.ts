import type { TabSection, TabView } from "../view/rows";
import type { TechPackTabId } from "../view/tabs";

/**
 * The seven tabs of the v3.9 tech pack editor (spec 09 screen 30, `08` v3.7: Overview · Body ·
 * Measurements · Materials · Callouts · Artworks · Labels), and how the eleven tabs of the v2.2 view
 * (`lib/techpack/view`, decision 0077) fold into them (plan v6 G2, decision 0151).
 *
 * v3.9 dropped four tabs. Nothing they held is dropped with them: each becomes a part of the tab it
 * belongs beside, under its own heading, so every section the view builds is drawn exactly once.
 *
 * - **Colourways** goes to Materials: a colourway is the colour of each fabric and trim.
 * - **Personalisation** goes to Artworks: a name and a number are artwork placed on a panel.
 * - **QC** goes to Measurements: the points it inspects are the points of measure. It is 🔒, because
 *   only Knitwright QC edits it (`qc-only.ts`).
 * - **Review** goes to Overview, last: it is the one part that reads every other tab.
 */

export const EDITOR_TABS = ["overview", "body", "measurements", "materials", "callouts", "artworks", "labels"] as const;
export type EditorTabId = (typeof EDITOR_TABS)[number];

export const EDITOR_TAB_LABELS: Readonly<Record<EditorTabId, string>> = {
  overview: "Overview",
  body: "Body",
  measurements: "Measurements",
  materials: "Materials",
  callouts: "Callouts",
  artworks: "Artworks",
  labels: "Labels",
};

/** Which v3.9 tab each v2.2 tab's content is drawn in. */
export const FOLDED_INTO: Readonly<Record<TechPackTabId, EditorTabId>> = {
  overview: "overview",
  body: "body",
  measurements: "measurements",
  materials: "materials",
  callouts: "callouts",
  artworks: "artworks",
  colourways: "materials",
  personalisation: "artworks",
  labels: "labels",
  qc: "measurements",
  review: "overview",
};

/** The heading a folded tab keeps inside the tab it joined, so a person still finds it by its old name. */
export const FOLDED_HEADINGS: Readonly<Partial<Record<TechPackTabId, string>>> = {
  colourways: "Colourways",
  personalisation: "Names & numbers",
  qc: "Quality control",
  review: "Still to fill",
};

/** One v2.2 tab's content, drawn inside a v3.9 tab. `heading` is null for the tab's own content. */
export type EditorPart = Readonly<{
  from: TechPackTabId;
  heading: string | null;
  lead: string;
  sections: readonly TabSection[];
}>;

export type EditorTab = Readonly<{ id: EditorTabId; label: string; parts: readonly EditorPart[] }>;

/** The v3.9 tab a v2.2 tab id now lives in, for a "go to" link out of the Review part. */
export const editorTabOf = (id: TechPackTabId): EditorTabId => FOLDED_INTO[id];

/**
 * The view's tabs, folded into the seven. A tab's own content comes first, then whatever folded
 * into it in the order the view had them, so Review stays last on Overview.
 */
export function foldTabs(tabs: readonly TabView[]): readonly EditorTab[] {
  return EDITOR_TABS.map((id) => {
    const own = tabs.filter((view) => view.id === id);
    const folded = tabs.filter((view) => view.id !== id && FOLDED_INTO[view.id] === id);
    return {
      id,
      label: EDITOR_TAB_LABELS[id],
      parts: [...own, ...folded].map((view) => ({
        from: view.id,
        heading: view.id === id ? null : (FOLDED_HEADINGS[view.id] ?? view.label),
        lead: view.lead,
        sections: view.sections,
      })),
    };
  });
}

/** True for a name read from an address. */
export const isEditorTab = (value: string): value is EditorTabId => (EDITOR_TABS as readonly string[]).includes(value);

/** The tab an address names, or Overview. A v2.2 tab name opens the tab it folded into. */
export function editorTabOr(value: string | null | undefined): EditorTabId {
  if (value === null || value === undefined) return "overview";
  if (isEditorTab(value)) return value;
  return value in FOLDED_INTO ? FOLDED_INTO[value as TechPackTabId] : "overview";
}
