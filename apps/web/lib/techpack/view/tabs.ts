/**
 * The tech pack view's tab bar (spec F-S6, the table of tabs). The order is the spec's and the
 * Review tab is last, because it is the one that says whether the other ten are finished.
 */

export const TECHPACK_TABS = [
  "overview",
  "body",
  "measurements",
  "materials",
  "callouts",
  "artworks",
  "colourways",
  "personalisation",
  "labels",
  "qc",
  "review",
] as const;
export type TechPackTabId = (typeof TECHPACK_TABS)[number];

/** What each tab's button says, exactly as spec F-S6 names it. */
export const TAB_LABELS: Readonly<Record<TechPackTabId, string>> = {
  overview: "Overview",
  body: "Body",
  measurements: "Measurements",
  materials: "Materials (BOM)",
  callouts: "Callouts",
  artworks: "Artworks",
  colourways: "Colourways",
  personalisation: "Personalisation",
  labels: "Labels & packaging",
  qc: "QC",
  review: "Review",
};

/** One line under each tab's heading, saying what the tab is for and who fills it. */
export const TAB_LEADS: Readonly<Record<TechPackTabId, string>> = {
  overview: "The style's own details. The header fields are yours; the rest come from the base article.",
  body: "The body size chart the garment is graded from, as the base article gives it.",
  measurements: "The points of measure, their grades and their tolerances, size by size.",
  materials: "The bill of materials: fabrics, threads, trims, labels and packaging.",
  callouts: "The construction callouts, numbered to match the pins on the drawing.",
  artworks: "Every graphic and pattern fill, with its type, size and place on a panel.",
  colourways: "One block per colourway: the colour roles, their references and their swatches.",
  personalisation: "Where a name and a number go, and how they look.",
  labels: "The care, size and brand labels for each destination market, and the fold and bag.",
  qc: "The inspection plan, the points of measure to check and the photographs to take.",
  review: "Everything still waiting for you, and the pre-export check of F-G2.",
};

/** The id in the address and in a test, for example `techpack-tab-measurements`. */
export const tabTestId = (id: TechPackTabId): string => `techpack-tab-${id}`;
export const tabPanelId = (id: TechPackTabId): string => `techpack-panel-${id}`;

/** True for a tab name read from an address or a stored choice. */
export const isTechPackTab = (value: string): value is TechPackTabId => (TECHPACK_TABS as readonly string[]).includes(value);

/** The tab a name picks out, or Overview when the name is not one of them. */
export const tabOr = (value: string | null | undefined): TechPackTabId =>
  value !== null && value !== undefined && isTechPackTab(value) ? value : "overview";
