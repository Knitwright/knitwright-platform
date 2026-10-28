import { SUGGESTION_SOURCES, allCells, type CompletenessReport, type ReadinessSection, type SectionId, type TechPack } from "@/lib/techpack";
import type { Provenance } from "@/lib/garment";
import type { Confirmable } from "./tech-pack-confirm";

/**
 * The factory file shown one section at a time. This is the model of its sections: the list in
 * order, how many things each still needs, how much of the file is settled, and the section named
 * in the address. Plain data and pure functions, so the screen only lays it out.
 */

export const FILE_SECTION_IDS = [
  "left",
  "cover",
  "readiness",
  "flats",
  "measurements",
  "how-to-measure",
  "pattern-and-cutting",
  "construction",
  "operations",
  "components",
  "fabric",
  "artwork",
  "artwork-and-colour",
  "labelling",
  "colourways",
  "illustrations",
  "patterns",
  "sources",
  "quote",
] as const;
export type FileSectionId = (typeof FILE_SECTION_IDS)[number];

/** The section shown when the address names none, or one the file does not have. */
export const DEFAULT_SECTION: FileSectionId = "cover";

interface NavSection {
  readonly id: FileSectionId;
  readonly label: string;
  /** The sections of the document that are shown in it. */
  readonly parts: readonly SectionId[];
}

/** The sections in the side list, in the order of the file. "What is left" is reached from the summary above it. */
export const NAV_SECTIONS: readonly NavSection[] = [
  { id: "cover", label: "Cover", parts: ["cover"] },
  { id: "readiness", label: "Ready for the factory", parts: ["readiness"] },
  { id: "flats", label: "Flats", parts: ["flats"] },
  { id: "measurements", label: "Measurements", parts: ["measurements"] },
  { id: "how-to-measure", label: "How to measure", parts: ["how-to-measure"] },
  { id: "pattern-and-cutting", label: "Pattern and cutting", parts: ["pattern-and-cutting"] },
  { id: "construction", label: "Construction", parts: ["construction"] },
  { id: "operations", label: "Order of work", parts: ["operations"] },
  { id: "components", label: "Bill of materials", parts: ["components"] },
  { id: "fabric", label: "Fabric", parts: ["fabric"] },
  { id: "artwork", label: "Artwork", parts: ["artwork"] },
  { id: "artwork-and-colour", label: "Artwork and colour", parts: ["artwork-and-colour"] },
  { id: "labelling", label: "Labelling", parts: ["labelling"] },
  { id: "colourways", label: "Colourways", parts: ["colourways"] },
  { id: "illustrations", label: "Illustrations", parts: [] },
  { id: "patterns", label: "Patterns", parts: [] },
  { id: "sources", label: "Sources and notes", parts: ["suggested", "sign-off"] },
  { id: "quote", label: "Request a quote", parts: [] },
];

export interface FileSection {
  readonly id: FileSectionId;
  readonly label: string;
  /** Empty fields plus suggestions and proposals nobody has made their own yet. */
  readonly left: number;
}

interface SectionsAvailable {
  /** True when illustrations were made for the design. */
  readonly illustrations: boolean;
}

/** The sections of tech pack v2. Their count is the open items of the readiness list, which are not all the brand's to fill in. */
export const PRODUCTION_SECTIONS: readonly FileSectionId[] = ["readiness", "pattern-and-cutting", "fabric", "artwork-and-colour"];

/** The readiness group each production section counts the open items of. "readiness" counts them all. */
const READINESS_GROUPS: Readonly<Partial<Record<FileSectionId, readonly string[]>>> = {
  readiness: ["pattern", "spec", "fabric", "print", "proof", "order", "release", "components"],
  "pattern-and-cutting": ["pattern"],
  fabric: ["fabric"],
  "artwork-and-colour": ["print"],
};

const openIn = (readiness: Pick<ReadinessSection, "groups"> | undefined, groups: readonly string[]): number =>
  (readiness?.groups ?? []).filter((group) => groups.includes(group.id)).reduce((sum, group) => sum + group.items.filter((entry) => !entry.met).length, 0);

/** The sections of this file with what each still needs. */
export function fileSections(
  report: Pick<CompletenessReport, "sections">,
  confirmables: readonly Pick<Confirmable, "sectionId">[],
  available: SectionsAvailable,
  readiness?: Pick<ReadinessSection, "groups">,
): readonly FileSection[] {
  return NAV_SECTIONS.filter((section) => section.id !== "illustrations" || available.illustrations).map((section) => {
    const empty = report.sections.filter((entry) => section.parts.includes(entry.id)).reduce((sum, entry) => sum + entry.items.length, 0);
    const suggested = confirmables.filter((item) => section.parts.includes(item.sectionId)).length;
    const readyGroups = READINESS_GROUPS[section.id];
    return { id: section.id, label: section.label, left: readyGroups ? openIn(readiness, readyGroups) : empty + suggested };
  });
}

/** "9 things left to fill in or make your own". */
export function thingsLeftSentence(count: number): string {
  if (count === 0) return "Nothing left to fill in or make your own";
  return `${count} ${count === 1 ? "thing" : "things"} left to fill in or make your own`;
}

export interface FileProgress {
  readonly settled: number;
  readonly total: number;
  /** Whole percent, rounded down, so a file with one value left never shows 100. */
  readonly percent: number;
}

const isSuggestion = (provenance: unknown): boolean => SUGGESTION_SOURCES.includes(provenance as Provenance);

/** A value is settled when it is set, is not a suggestion, and is not a proposal. */
const settledCell = (cell: Record<string, unknown>): boolean =>
  cell.status === "set" && !isSuggestion(cell.provenance) && cell.proposal !== true;

/** The share of the given cells that are settled. A list with no cells is all settled. */
export function progressOf(cells: readonly Record<string, unknown>[]): FileProgress {
  const settled = cells.filter(settledCell).length;
  const total = cells.length;
  return { settled, total, percent: total === 0 ? 100 : Math.floor((settled / total) * 100) };
}

/**
 * How much of the file is settled, counted over the values a factory reads. The list of
 * suggestions and the sign-off repeat values of other sections, so they are not counted again.
 */
export function fileProgress(pack: TechPack): FileProgress {
  const parts = [pack.cover, pack.measurements, pack.components, pack.construction, pack.colourways, pack.artwork, pack.labelling];
  return progressOf(parts.flatMap((part) => allCells(part).map((found) => found.cell)));
}

/** The section named in the address, or the cover when it names none the file has. */
export function parseSection(value: string | readonly string[] | undefined, available: readonly FileSectionId[]): FileSectionId {
  const first = typeof value === "string" ? value : value?.[0];
  const found = available.find((id) => id === first);
  return found ?? DEFAULT_SECTION;
}

/** The query of the address of a section, keeping what else the address says, such as the colourway. */
export function sectionSearch(search: string, id: FileSectionId): string {
  const params = new URLSearchParams(search);
  params.set("section", id);
  return `?${params.toString()}`;
}

/** The query of an address without its section, so two addresses can be compared. */
const withoutSection = (search: string): string => {
  const params = new URLSearchParams(search);
  params.delete("section");
  params.sort();
  return params.toString();
};

/**
 * The section a link opens when it is an address of this same file, with the same colourway, and
 * no place on the page; otherwise null. Such a link can show its section at once, with no new page.
 */
export function sectionOfLink(href: string, here: URL, available: readonly FileSectionId[]): FileSectionId | null {
  const target = new URL(href, here);
  if (target.origin !== here.origin || target.pathname !== here.pathname || target.hash !== "") return null;
  if (withoutSection(target.search) !== withoutSection(here.search)) return null;
  const named = target.searchParams.get("section");
  return available.find((id) => id === named) ?? null;
}

/** How many values accepting every suggestion sets: each size of a measurement and its tolerance count one each. */
export function suggestedValueCount(confirmables: readonly Pick<Confirmable, "target">[]): number {
  return confirmables.reduce((sum, { target }) => {
    if (target.kind !== "measurement") return sum + 1;
    return sum + target.values.length + (target.tolerance === null ? 0 : 1);
  }, 0);
}
