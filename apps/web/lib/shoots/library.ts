import { ALL_SHOOT_CONCEPTS, conceptGap } from "./concepts";
import { SHOOT_STYLE_LABELS, type ShootConcept, type ShootGap, type ShootStyle } from "./types";

/**
 * THE SHOOT IDEAS LIBRARY PANEL'S OWN LOGIC (spec F-L1, "Shoot ideas library").
 *
 * It is all pure: the panel hands in the concepts it was given and gets back what to draw, so the
 * panel is tested with no shell and no browser (L1's contract, `panelDouble()`).
 *
 * Search covers the words a person would actually type -- the title, the lead, the light, the sport
 * and mood tags and the style -- and the three filters are the ones F-L1's own library offers that
 * mean anything for a shoot: sport, mood, and whether there is a person in it. There is no article
 * filter here for the same reason L2's panel has none: `07` ties a scene to garment slots, not to one
 * base article (`ARTICLE_FILTER_GAP` there says so on the screen).
 */

export interface ConceptFilters {
  readonly text: string;
  readonly sport: string | null;
  readonly mood: string | null;
  /** True for shoots with a person in them, false for garment-only shoots, null for both. */
  readonly withPeople: boolean | null;
}

export const NO_FILTERS: ConceptFilters = { text: "", sport: null, mood: null, withPeople: null };

const haystack = (concept: ShootConcept): string =>
  [concept.title, concept.lead, concept.lighting, SHOOT_STYLE_LABELS[concept.style], ...concept.sports, ...concept.moods]
    .join(" ")
    .toLowerCase();

const matchesText = (concept: ShootConcept, text: string): boolean => {
  const words = text.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return true;
  const hay = haystack(concept);
  return words.every((word) => hay.includes(word));
};

/** True when a concept passes every filter that is set. */
export function matches(concept: ShootConcept, filters: ConceptFilters): boolean {
  if (!matchesText(concept, filters.text)) return false;
  if (filters.sport !== null && !concept.sports.includes(filters.sport)) return false;
  if (filters.mood !== null && !concept.moods.includes(filters.mood)) return false;
  if (filters.withPeople !== null && concept.needsModel !== filters.withPeople) return false;
  return true;
}

export const filterConcepts = (concepts: readonly ShootConcept[], filters: ConceptFilters): readonly ShootConcept[] =>
  concepts.filter((concept) => matches(concept, filters));

export interface FilterChoice {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

const word = (value: string): string => value.replace(/-/g, " ").replace(/^./, (first) => first.toUpperCase());

function countOf(concepts: readonly ShootConcept[], tags: (concept: ShootConcept) => readonly string[]): readonly FilterChoice[] {
  const counts = new Map<string, number>();
  for (const concept of concepts) for (const tag of tags(concept)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({ value, label: word(value), count }));
}

export const sportChoices = (concepts: readonly ShootConcept[]): readonly FilterChoice[] => countOf(concepts, (concept) => concept.sports);

export const moodChoices = (concepts: readonly ShootConcept[]): readonly FilterChoice[] => countOf(concepts, (concept) => concept.moods);

/** The two people choices, with a count each, in the order a person reads them. */
export const peopleChoices = (concepts: readonly ShootConcept[]): readonly FilterChoice[] =>
  [
    { value: "with", label: "With a person", count: concepts.filter((concept) => concept.needsModel).length },
    { value: "without", label: "Garment only", count: concepts.filter((concept) => !concept.needsModel).length },
  ].filter((choice) => choice.count > 0);

/** True when nothing is set, so the panel can tell "nothing found" from "nothing searched for". */
export const anyFilterSet = (filters: ConceptFilters): boolean =>
  filters.text.trim() !== "" || filters.sport !== null || filters.mood !== null || filters.withPeople !== null;

/** The style choices, used by the custom shoot panel rather than the library. */
export const styleChoices = (): readonly Readonly<{ value: ShootStyle; label: string }>[] =>
  (Object.keys(SHOOT_STYLE_LABELS) as ShootStyle[]).map((style) => ({ value: style, label: SHOOT_STYLE_LABELS[style] }));

/** Every gap the library has to show: one per concept that cannot offer the poses `07` asks for. */
export function libraryGaps(concepts: readonly ShootConcept[] = ALL_SHOOT_CONCEPTS): readonly ShootGap[] {
  const seen = new Map<string, ShootGap>();
  for (const concept of concepts) {
    const gap = conceptGap(concept);
    if (gap !== null) seen.set(gap.line, gap);
  }
  return [...seen.values()];
}
