import type { Provenance } from "@/lib/garment";
import { describeCell } from "./suggested-labels";
import { PROPOSAL_WORDS, listOf } from "./text";
import type { SuggestedItem, SuggestedSection, TechPack } from "./types";
import { SECTION_TITLES } from "./types";
import { allCells } from "./walk";

/** The sources that mean a value is a suggestion, so the brand should confirm it. */
export const SUGGESTION_SOURCES: readonly Provenance[] = ["suggested-chart", "ai-suggested", "read-from-image"];

const NONE = "Nothing in this document is a suggestion from a size chart, the assistant or a picture.";
const SOME = "Every value in the first list is a suggestion. Confirm each one, or replace it with your own.";
const NO_PROPOSALS = "Nothing in this document is proposed by Knitwright.";
const SOME_PROPOSALS = `${PROPOSAL_WORDS} These are the seam and stitch classes, and the parts, that Knitwright proposes from general knitwear practice.`;

/** The document without the two parts that are made from it. */
export type Finished = Omit<TechPack, "suggested" | "sections">;

interface Group {
  readonly sectionId: SuggestedItem["sectionId"];
  readonly subject: string;
  readonly provenance: Provenance;
  readonly fields: string[];
  readonly sizes: string[];
  cells: number;
}

const sizesText = (sizes: readonly string[]): string => `${sizes.length === 1 ? "size" : "sizes"} ${listOf(sizes)}`;

function labelOf(group: Group): string {
  const words = [...(group.sizes.length > 0 ? [`value for ${sizesText(group.sizes)}`] : []), ...group.fields];
  return words.length === 0 ? group.subject : `${group.subject}: ${listOf(words)}`;
}

const itemOf = (group: Group): SuggestedItem => ({
  sectionId: group.sectionId,
  sectionTitle: SECTION_TITLES[group.sectionId],
  label: labelOf(group),
  provenance: group.provenance,
  cells: group.cells,
});

/**
 * Every cell of the document whose source is a suggestion, and every cell the platform proposes,
 * found in ONE pass over all the cells. Cells that belong to the same thing and the same source
 * are listed together. Nothing is picked from a list of what to look for, so nothing can be left off.
 */
export function buildSuggested(pack: Finished | TechPack): SuggestedSection {
  const document = {
    ...pack,
    suggested: null,
    flats: { ...pack.flats, views: pack.flats.views.map((view) => ({ ...view, model: null })) },
  };
  const suggestions = new Map<string, Group>();
  const proposals = new Map<string, Group>();
  for (const { path, cell } of allCells(document)) {
    if (cell.status !== "set") continue;
    const provenance = cell.provenance as Provenance;
    const proposed = cell.proposal === true;
    if (!proposed && !SUGGESTION_SOURCES.includes(provenance)) continue;
    const place = describeCell(document, path);
    const groups = proposed ? proposals : suggestions;
    const key = `${place.sectionId}|${place.subject}|${provenance}`;
    const group = groups.get(key) ?? { sectionId: place.sectionId, subject: place.subject, provenance, fields: [], sizes: [], cells: 0 };
    group.cells += 1;
    if (place.field === "choice") group.fields.push(String(cell.value));
    else if (place.field === "value") {
      if (place.size !== null) group.sizes.push(place.size);
    } else if (place.field !== "" && !group.fields.includes(place.field)) group.fields.push(place.field);
    groups.set(key, group);
  }
  const items = [...suggestions.values()].map(itemOf);
  const proposed = [...proposals.values()].map(itemOf);
  return {
    id: "suggested",
    title: SECTION_TITLES.suggested,
    note: items.length === 0 ? NONE : SOME,
    items,
    proposals: proposed,
    proposalsNote: proposed.length === 0 ? NO_PROPOSALS : SOME_PROPOSALS,
  };
}
