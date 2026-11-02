import { CROP_LABELS } from "./crops";
import { MOCKUP_GAP_RULE, PEOPLE_BAND_LABELS, SCENE_GROUPS, SCENE_GROUP_LABELS, type Crop, type MockupScene, type PeopleBand, type SceneGap, type SceneGroup } from "./types";

/**
 * The mockup library panel's own logic (spec F-L1, "Mockup library panel"):
 *
 *   * **collections** -- `07`'s seven scene groups, each shown short with a "Show all";
 *   * **search** -- over the words a person would actually type: the title, the group, the
 *     lighting, the pose and the camera;
 *   * **filters** -- sport, mood, people (none / 1 / team) and aspect;
 *   * **a crown on a premium item** -- which is exactly the scenes a model runs, because `07` makes
 *     the deterministic scenes free and the AI ones cost credits.
 *
 * It is all pure: the panel passes the scenes it was given and gets back what to draw, so the panel
 * needs no shell and no browser to be tested.
 *
 * **The article filter F-L1 lists is not here, and that is deliberate.** `07` ties a scene to
 * garment *slots*, not to one base article, so there is nothing true to filter on: the article is
 * whatever design feeds the board. `ARTICLE_FILTER_GAP` says so on the screen rather than offering a
 * control that would quietly do nothing.
 */

/** How many scenes a collection shows before "Show all". */
export const COLLECTION_PREVIEW = 6;

export const ARTICLE_FILTER_GAP: SceneGap = {
  ruleId: MOCKUP_GAP_RULE,
  line: "F-L1 lists an article filter. A scene is not tied to one article in 07: its garment slots take whatever design feeds the board, so there is nothing to filter on yet.",
};

export interface SceneFilters {
  readonly text: string;
  readonly sport: string | null;
  readonly mood: string | null;
  readonly people: PeopleBand | null;
  readonly crop: Crop | null;
  /** True to show only the scenes that cost nothing, which is the deterministic half. */
  readonly freeOnly: boolean;
}

export const NO_FILTERS: SceneFilters = { text: "", sport: null, mood: null, people: null, crop: null, freeOnly: false };

/** Every word of a scene a person might search by. */
const haystack = (scene: MockupScene): string =>
  [scene.title, SCENE_GROUP_LABELS[scene.group], scene.lighting, scene.backdrop.label, ...scene.slots.flatMap((slot) => [slot.pose, slot.camera])]
    .join(" ")
    .toLowerCase();

const matchesText = (scene: MockupScene, text: string): boolean => {
  const words = text.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return true;
  const hay = haystack(scene);
  return words.every((word) => hay.includes(word));
};

/** True when a scene passes every filter that is set. */
export function matches(scene: MockupScene, filters: SceneFilters): boolean {
  if (!matchesText(scene, filters.text)) return false;
  if (filters.sport !== null && !scene.sports.includes(filters.sport)) return false;
  if (filters.mood !== null && !scene.moods.includes(filters.mood)) return false;
  if (filters.people !== null && scene.people !== filters.people) return false;
  if (filters.crop !== null && !scene.crops.includes(filters.crop)) return false;
  if (filters.freeOnly && scene.source !== "deterministic") return false;
  return true;
}

export const filterScenes = (scenes: readonly MockupScene[], filters: SceneFilters): readonly MockupScene[] => scenes.filter((scene) => matches(scene, filters));

/** True when a scene costs credits, which is what the spec puts a crown on. */
export const isPremium = (scene: MockupScene): boolean => scene.source === "ai";

export interface Collection {
  readonly group: SceneGroup;
  readonly label: string;
  readonly scenes: readonly MockupScene[];
  /** The first few, which is all the panel shows until "Show all" is pressed. */
  readonly shown: readonly MockupScene[];
  readonly hidden: number;
}

/**
 * The collections to draw: one per group that has a scene left after the filters, in `07`'s order.
 * A group with nothing left is left out entirely, so the panel never shows an empty shelf.
 */
export function collectionsOf(scenes: readonly MockupScene[], filters: SceneFilters = NO_FILTERS, expanded: readonly SceneGroup[] = []): readonly Collection[] {
  const kept = filterScenes(scenes, filters);
  return SCENE_GROUPS.flatMap((group) => {
    const inGroup = kept.filter((scene) => scene.group === group);
    if (inGroup.length === 0) return [];
    const open = expanded.includes(group);
    const shown = open ? inGroup : inGroup.slice(0, COLLECTION_PREVIEW);
    return [{ group, label: SCENE_GROUP_LABELS[group], scenes: inGroup, shown, hidden: inGroup.length - shown.length }];
  });
}

export interface FilterChoice {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/** The sport choices a filter offers, each with how many scenes it would leave. */
export const sportChoices = (scenes: readonly MockupScene[]): readonly FilterChoice[] => countOf(scenes, (scene) => scene.sports);

export const moodChoices = (scenes: readonly MockupScene[]): readonly FilterChoice[] => countOf(scenes, (scene) => scene.moods);

/** The people bands in the order F-L1 lists them, with a count each. */
export const peopleChoices = (scenes: readonly MockupScene[]): readonly FilterChoice[] =>
  (["none", "one", "team"] as const)
    .map((band) => ({ value: band, label: PEOPLE_BAND_LABELS[band], count: scenes.filter((scene) => scene.people === band).length }))
    .filter((choice) => choice.count > 0);

/** The aspects the scenes between them can be cut to, with a count each. */
export const cropChoices = (scenes: readonly MockupScene[]): readonly FilterChoice[] =>
  countOf(scenes, (scene) => scene.crops).map((choice) => ({ ...choice, label: CROP_LABELS[choice.value as Crop] ?? choice.value }));

function countOf(scenes: readonly MockupScene[], tags: (scene: MockupScene) => readonly string[]): readonly FilterChoice[] {
  const counts = new Map<string, number>();
  for (const scene of scenes) for (const tag of tags(scene)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, label: value.replace(/-/g, " ").replace(/^./, (first) => first.toUpperCase()), count }));
}

/** True when nothing is set, so the panel can tell "nothing found" from "nothing searched for". */
export const anyFilterSet = (filters: SceneFilters): boolean =>
  filters.text.trim() !== "" || filters.sport !== null || filters.mood !== null || filters.people !== null || filters.crop !== null || filters.freeOnly;
