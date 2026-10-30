import type { SectionId } from "../types";
import type { ExportSection, ExportTable } from "./table-types";

/**
 * THE SIXTEEN PAGES (spec `docs/spec/02-features.md` F-S6, plan v5 Y5, decision 0078).
 *
 * The specification lists sixteen pages for the tech pack PDF, in order, each with the header
 * block and a "Page x of y" footer. This file is the only place that says which page a part of
 * the document belongs to: the PDF reads it to lay the pages out, and a test reads it to check
 * that every section of the document reaches a page.
 *
 * Nothing here invents content. A page the platform cannot fill yet says so in plain words
 * instead of showing something nobody drew: see `PAGE_GAPS`.
 */

export const PAGE_IDS = [
  "overview",
  "technical-flats",
  "colour-views",
  "bom-fabrics",
  "bom-parts",
  "construction",
  "construction-annotations",
  "measurement-annotation",
  "size-grading",
  "graphics",
  "print-placement",
  "personalisation",
  "labels-packaging",
  "colourways",
  "qc",
  "reference-images",
] as const;
export type PageId = (typeof PAGE_IDS)[number];

/**
 * The pages after the sixteen. The specification's own worked example keeps a factory sign-off
 * page 17 for base onboarding, and this document's values each carry a mark for where they came
 * from, so the key to those marks has to be in the file too.
 */
export const CLOSING_PAGE_IDS = ["sources-and-notes", "confirm-and-sign-off"] as const;
export type ClosingPageId = (typeof CLOSING_PAGE_IDS)[number];

export type AnyPageId = PageId | ClosingPageId;

/** What a page draws, beside its tables. */
export type PageDrawing =
  /** Front and back with every colour taken out, as a factory's technical flat. */
  | "flats-mono"
  /** Front and back in the colourway the document is for, without callouts. */
  | "flats-colour"
  /** Front and back with the lettered callout marks on them. */
  | "flats-callouts"
  /** One front for each colourway. */
  | "colourway-fronts"
  /** The photoreal pictures of the design, each labelled an illustration. */
  | "illustrations";

export interface TechPackPage {
  readonly id: PageId;
  /** 1 to 16, the number the specification gives the page. */
  readonly number: number;
  readonly title: string;
  /** One plain sentence under the title saying what the page is for. */
  readonly lead: string;
  readonly drawing: PageDrawing | null;
}

/** The sixteen pages, in the specification's order, with the specification's content. */
export const TECH_PACK_PAGES: readonly TechPackPage[] = [
  { id: "overview", number: 1, title: "Overview", lead: "The style, who it is for, and the choices this version was made with.", drawing: null },
  {
    id: "technical-flats",
    number: 2,
    title: "Technical flats",
    lead: "The garment drawn flat, front and back, with no colour in it.",
    drawing: "flats-mono",
  },
  {
    id: "colour-views",
    number: 3,
    title: "Rendered colour views",
    lead: "The same two views in the colourway this document is for.",
    drawing: "flats-colour",
  },
  { id: "bom-fabrics", number: 4, title: "Bill of materials: fabrics", lead: "Every fabric, what it is made of, and what it was measured at.", drawing: null },
  {
    id: "bom-parts",
    number: 5,
    title: "Bill of materials: rib, thread, trims and labels",
    lead: "Every other part the garment is built from.",
    drawing: null,
  },
  { id: "construction", number: 6, title: "Construction details", lead: "Seam by seam: the class, the stitch, the density, and the order of work.", drawing: null },
  {
    id: "construction-annotations",
    number: 7,
    title: "Construction annotations",
    lead: "The drawing with its marks, and what each mark on it is.",
    drawing: "flats-callouts",
  },
  {
    id: "measurement-annotation",
    number: 8,
    title: "Measurement annotation",
    lead: "How each lettered point of measure is taken. The letters are the marks on the construction annotations page.",
    drawing: null,
  },
  { id: "size-grading", number: 9, title: "Size grading", lead: "Every point of measure across the sizes, with its tolerance.", drawing: null },
  { id: "graphics", number: 10, title: "Graphics and prints", lead: "The artwork as it goes to print: its colours, its layers and its repeat.", drawing: null },
  { id: "print-placement", number: 11, title: "Print placement", lead: "Where each piece of artwork sits, on which panel, at what size.", drawing: null },
  { id: "personalisation", number: 12, title: "Personalisation", lead: "Where a name or a number goes, and how it is made.", drawing: null },
  { id: "labels-packaging", number: 13, title: "Labels and packaging", lead: "What the labels say, how the garment is folded and what it is bagged in.", drawing: null },
  {
    id: "colourways",
    number: 14,
    title: "Colourways",
    lead: "Each colourway, panel by panel, with the front drawn in it.",
    drawing: "colourway-fronts",
  },
  { id: "qc", number: 15, title: "QC checklist", lead: "What to check before the garment ships, and what the records say so far.", drawing: null },
  {
    id: "reference-images",
    number: 16,
    title: "Reference images",
    lead: "Pictures of the design. Each one says whether it is a photograph of a sample or a render.",
    drawing: "illustrations",
  },
];

export const CLOSING_PAGES: readonly Readonly<{ id: ClosingPageId; title: string; lead: string }>[] = [
  {
    id: "sources-and-notes",
    title: "Sources and notes",
    lead: "Where every value in this document came from, and the notes that go with single values.",
  },
  {
    id: "confirm-and-sign-off",
    title: "Still to confirm, and sign-off",
    lead: "What nobody has confirmed yet, and the lines a factory signs during base onboarding.",
  },
];

/**
 * A page of the sixteen that the platform cannot fill from a design yet, with the words it says
 * instead and the rule that would explain it. No rulebook entry covers either gap, so both carry
 * `R-GAP-000` and are listed on the pull request. The page prints the words and not the rule id:
 * `R-GAP-000` means "no rule written yet", which tells a factory nothing it can act on.
 */
export const PAGE_GAPS: Readonly<Partial<Record<PageId, Readonly<{ note: string; ruleId: string }>>>> = {
  "construction-annotations": {
    note: "The marks on this drawing are the points of measure. Construction callouts numbered on the flat are not drawn yet; the construction details page carries the construction itself.",
    ruleId: "R-GAP-000",
  },
  "reference-images": {
    note: "No photograph of a sample is on file for this version, so nothing here is a photograph. Every picture in this document is a render, not a photo.",
    ruleId: "R-GAP-000",
  },
};

/** Which page each section of the document belongs to by default. A table may name a different one. */
export const SECTION_PAGE: Readonly<Record<SectionId, AnyPageId>> = {
  cover: "overview",
  readiness: "qc",
  flats: "construction-annotations",
  measurements: "size-grading",
  "how-to-measure": "measurement-annotation",
  "pattern-and-cutting": "qc",
  components: "bom-fabrics",
  fabric: "bom-fabrics",
  construction: "construction",
  colourways: "colourways",
  artwork: "print-placement",
  "artwork-and-colour": "graphics",
  operations: "construction",
  labelling: "labels-packaging",
  suggested: "confirm-and-sign-off",
  "sign-off": "confirm-and-sign-off",
};

/** One section's share of a page: its heading, its sentences and the tables of its that sit here. */
export interface PageBlock {
  readonly sectionId: SectionId;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly tables: readonly ExportTable[];
}

export interface PlannedPage {
  readonly id: AnyPageId;
  /** 1 to 16 for one of the specification's pages, or null for a page after them. */
  readonly number: number | null;
  readonly title: string;
  readonly lead: string;
  /** What the platform cannot fill on this page, in plain words, or null. */
  readonly gap: Readonly<{ note: string; ruleId: string }> | null;
  readonly drawing: PageDrawing | null;
  readonly blocks: readonly PageBlock[];
}

/** The page a table belongs to: the one it names, or its section's. */
const pageOfTable = (section: ExportSection, table: ExportTable): AnyPageId => table.page ?? SECTION_PAGE[section.id];

/**
 * A section's block for one page: its heading and sentences go with the page its section belongs
 * to, and each table goes with the page it names. A section with nothing on this page has no block.
 */
function blockFor(section: ExportSection, page: AnyPageId): PageBlock | null {
  const tables = section.tables.filter((table) => pageOfTable(section, table) === page);
  const lead = SECTION_PAGE[section.id] === page;
  if (!lead && tables.length === 0) return null;
  return { sectionId: section.id, title: section.title, paragraphs: lead ? section.paragraphs : [], tables };
}

/**
 * The document laid out as pages: the specification's sixteen in its order, then the pages after
 * them. Every page is here, filled or not, because a factory counts pages and a missing one reads
 * as a page that was lost.
 */
export function pagePlan(sections: readonly ExportSection[]): readonly PlannedPage[] {
  const blocksOf = (page: AnyPageId): readonly PageBlock[] =>
    sections.flatMap((section) => {
      const block = blockFor(section, page);
      return block === null ? [] : [block];
    });
  const sixteen = TECH_PACK_PAGES.map(
    (page): PlannedPage => ({
      id: page.id,
      number: page.number,
      title: page.title,
      lead: page.lead,
      gap: PAGE_GAPS[page.id] ?? null,
      drawing: page.drawing,
      blocks: blocksOf(page.id),
    }),
  );
  const closing = CLOSING_PAGES.map(
    (page): PlannedPage => ({ id: page.id, number: null, title: page.title, lead: page.lead, gap: null, drawing: null, blocks: blocksOf(page.id) }),
  );
  return [...sixteen, ...closing];
}

/** Every rule id the page plan leans on, for the pull request's list of gaps. */
export const pageGapRuleIds = (): readonly string[] => [...new Set(Object.values(PAGE_GAPS).map((gap) => gap.ruleId))];
