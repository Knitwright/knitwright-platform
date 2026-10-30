import type { SectionId } from "../types";
import { pagePlan, type AnyPageId, type PageBlock } from "./pages";
import type { ExportSection } from "./table-types";

/**
 * THE TABS OF THE TECH PACK, AND THE SHEETS OF THE EXCEL FILE (spec F-S6, decision 0078).
 *
 * The tech pack view has eleven tabs, and the Excel file has one sheet for each of them. The
 * sheets are built from the same tables as the PDF's sixteen pages — each page belongs to one tab
 * — so the two files cannot disagree about a value, which is what F-S6's acceptance asks.
 */

export const TAB_IDS = [
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
export type TabId = (typeof TAB_IDS)[number];

export interface TechPackTab {
  readonly id: TabId;
  /** The name of the sheet. Excel allows at most 31 characters and none of \\ / ? * [ ] : */
  readonly sheet: string;
  /** One plain sentence at the top of the sheet. */
  readonly lead: string;
}

export const TECH_PACK_TABS: readonly TechPackTab[] = [
  { id: "overview", sheet: "Overview", lead: "The style, who it is for, and the choices this version was made with." },
  {
    id: "body",
    sheet: "Body size chart",
    lead: "The body size chart the garment is graded from belongs to the base article and is not in this document yet.",
  },
  { id: "measurements", sheet: "Measurements", lead: "Every point of measure across the sizes, with its tolerance and how it is taken." },
  { id: "materials", sheet: "Materials", lead: "Every fabric and every other part the garment is built from." },
  { id: "callouts", sheet: "Callouts", lead: "The construction, the order of work, and what each mark on the drawing is." },
  { id: "artworks", sheet: "Artworks", lead: "The artwork as it goes to print, and where each piece of it sits." },
  { id: "colourways", sheet: "Colourways", lead: "Each colourway, panel by panel." },
  { id: "personalisation", sheet: "Personalisation", lead: "Where a name or a number goes, and how it is made." },
  { id: "labels", sheet: "Labels and packaging", lead: "What the labels say, how the garment is folded and what it is bagged in." },
  { id: "qc", sheet: "QC", lead: "What to check before the garment ships, and what the records say so far." },
  { id: "review", sheet: "Review", lead: "What nobody has confirmed yet, and the lines a factory signs during base onboarding." },
];

/** The tab each page of the PDF belongs to. A page that only draws pictures has no sheet. */
export const TAB_OF_PAGE: Readonly<Record<AnyPageId, TabId | null>> = {
  overview: "overview",
  "technical-flats": null,
  "colour-views": null,
  "bom-fabrics": "materials",
  "bom-parts": "materials",
  construction: "callouts",
  "construction-annotations": "callouts",
  "measurement-annotation": "measurements",
  "size-grading": "measurements",
  graphics: "artworks",
  "print-placement": "artworks",
  personalisation: "personalisation",
  "labels-packaging": "labels",
  colourways: "colourways",
  qc: "qc",
  "reference-images": null,
  "sources-and-notes": null,
  "confirm-and-sign-off": "review",
};

export interface PlannedTab extends TechPackTab {
  readonly blocks: readonly PageBlock[];
}

/** Blocks of the same section joined into one, so a section split over two pages reads once on a sheet. */
function mergeBlocks(blocks: readonly PageBlock[]): readonly PageBlock[] {
  const byId = new Map<SectionId, PageBlock>();
  for (const block of blocks) {
    const found = byId.get(block.sectionId);
    if (!found) byId.set(block.sectionId, block);
    else {
      byId.set(block.sectionId, {
        ...found,
        paragraphs: [...found.paragraphs, ...block.paragraphs],
        tables: [...found.tables, ...block.tables],
      });
    }
  }
  return [...byId.values()];
}

/** The notes of a section, which explain single values, added after that section's tables. */
const withNotes = (block: PageBlock, sections: readonly ExportSection[]): PageBlock => {
  const notes = sections.find((section) => section.id === block.sectionId)?.notes ?? [];
  return notes.length === 0 ? block : { ...block, tables: [...block.tables, ...notes] };
};

/**
 * The document laid out as the eleven sheets of the Excel file. Every sheet is written, even one
 * the platform cannot fill yet, because a factory that opens the file counts the tabs.
 */
export function tabPlan(sections: readonly ExportSection[]): readonly PlannedTab[] {
  const pages = pagePlan(sections);
  return TECH_PACK_TABS.map((tab) => {
    const blocks = pages.filter((page) => TAB_OF_PAGE[page.id] === tab.id).flatMap((page) => page.blocks);
    return { ...tab, blocks: mergeBlocks(blocks).map((block) => withNotes(block, sections)) };
  });
}
