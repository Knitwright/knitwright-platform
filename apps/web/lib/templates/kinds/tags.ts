import { COLOUR_FAMILIES, COLOUR_FAMILY_LABELS, type ColourFamily } from "../colour-family";
import { STYLE_IDS, STYLE_LABELS, type StyleId } from "../catalogue";

/**
 * The launch tag set of `docs/spec/07-template-library.md`: sport, style, era, mood and colour
 * family. Style and colour family already have columns and vocabularies (`style_tags`,
 * `colour_family`), so this file adds the three that did not exist and gathers all five behind one
 * read, which a picker or a library panel filters and searches on.
 *
 * Every value is Knitwright's own tag for finding a kit on a screen. None of them is a factory fact:
 * a sport tag says what a kit is for, not that a league accepts it, and an era or mood tag says how
 * a design looks. The same lists are the closed checks of
 * `migrations/20261201050000_template_kinds.sql`, and `tags.test.ts` holds this file to that file.
 */

/** The six sport groups of `07`'s design-template table. `sport_tags` carries them. */
export const SPORT_TAGS = ["football", "cricket", "training", "esports", "running-gym", "combat"] as const;
export type SportTag = (typeof SPORT_TAGS)[number];

export const SPORT_TAG_LABELS: Readonly<Record<SportTag, string>> = {
  football: "Football",
  cricket: "Cricket",
  training: "Training",
  esports: "Esports",
  "running-gym": "Running and gym",
  combat: "Combat",
};

export const ERA_TAGS = ["classic", "retro-90s", "modern"] as const;
export type EraTag = (typeof ERA_TAGS)[number];

export const ERA_TAG_LABELS: Readonly<Record<EraTag, string>> = {
  classic: "Classic",
  "retro-90s": "Retro 90s",
  modern: "Modern",
};

export const MOOD_TAGS = ["bold", "clean", "sharp", "playful", "understated"] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];

export const MOOD_TAG_LABELS: Readonly<Record<MoodTag, string>> = {
  bold: "Bold",
  clean: "Clean",
  sharp: "Sharp",
  playful: "Playful",
  understated: "Understated",
};

/** The five tag groups of `07`, in the order a filter panel shows them. */
export const TAG_GROUPS = ["sport", "style", "era", "mood", "colour"] as const;
export type TagGroup = (typeof TAG_GROUPS)[number];

export const TAG_GROUP_LABELS: Readonly<Record<TagGroup, string>> = {
  sport: "Sport",
  style: "Style",
  era: "Era",
  mood: "Mood",
  colour: "Colour family",
};

/** One group's choices, each with the words a screen shows. */
export interface TagChoice {
  readonly id: string;
  readonly label: string;
}

const choices = <T extends string>(ids: readonly T[], labels: Readonly<Record<T, string>>): readonly TagChoice[] =>
  ids.map((id) => ({ id, label: labels[id] }));

/** Every choice of every group, for a filter panel. Nothing here reads the database. */
export const TAG_CHOICES: Readonly<Record<TagGroup, readonly TagChoice[]>> = {
  sport: choices(SPORT_TAGS, SPORT_TAG_LABELS),
  style: choices(STYLE_IDS, STYLE_LABELS),
  era: choices(ERA_TAGS, ERA_TAG_LABELS),
  mood: choices(MOOD_TAGS, MOOD_TAG_LABELS),
  colour: choices(COLOUR_FAMILIES, COLOUR_FAMILY_LABELS),
};

/** The tags one template carries. A template always has a colour family and at least one style tag. */
export interface TemplateTags {
  readonly sport: readonly SportTag[];
  readonly style: readonly StyleId[];
  readonly era: readonly EraTag[];
  readonly mood: readonly MoodTag[];
  readonly colour: ColourFamily;
}

/** What a tag filter asks for: nothing, or one choice per group. A group left out narrows nothing. */
export type TagFilter = Partial<Readonly<Record<TagGroup, string>>>;

const held = (tags: TemplateTags, group: TagGroup): readonly string[] =>
  group === "colour" ? [tags.colour] : tags[group];

/** True when the template carries every tag the filter names. An unknown value matches nothing, so a mistyped filter shows none. */
export const matchesTags = (tags: TemplateTags, filter: TagFilter): boolean =>
  TAG_GROUPS.every((group) => {
    const wanted = filter[group];
    return wanted === undefined || wanted === "" || held(tags, group).includes(wanted);
  });

/** The words a search looks through: the title and every tag's label, lower case. */
export const searchTextOf = (title: string, tags: TemplateTags): string =>
  [
    title,
    ...tags.sport.map((id) => SPORT_TAG_LABELS[id]),
    ...tags.style.map((id) => STYLE_LABELS[id]),
    ...tags.era.map((id) => ERA_TAG_LABELS[id]),
    ...tags.mood.map((id) => MOOD_TAG_LABELS[id]),
    COLOUR_FAMILY_LABELS[tags.colour],
  ]
    .join(" ")
    .toLowerCase();

/** True when every word of the query is in the title or one of the tags. An empty query matches everything. */
export function matchesSearch(title: string, tags: TemplateTags, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/u).filter((word) => word !== "");
  if (words.length === 0) return true;
  const text = searchTextOf(title, tags);
  return words.every((word) => text.includes(word));
}
