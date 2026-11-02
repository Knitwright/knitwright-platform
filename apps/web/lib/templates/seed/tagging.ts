import type { Sport, StyleId } from "../catalogue";
import type { EraTag, MoodTag, SportTag, TemplateTags } from "../kinds/tags";
import type { SeedTemplate } from "./build";

/**
 * The launch tags of `docs/spec/07-template-library.md` for a starter: sport, style, era, mood and
 * colour family (plan v5 L8, decision 0098).
 *
 * Style and colour family the starter already carries. The other three are added here:
 *
 *  * **Sport** is `07`'s six groups. Four of them are the library's own `sport` column; `esports` and
 *    `combat` are not in that column's five values, so a starter in one of those groups is filed
 *    under `general` there and named here. The column's `running` is `07`'s "running / gym" group.
 *  * **Era and mood** are Knitwright's own words for how a design looks, for search and the
 *    inspiration board (F-S1). They are not a factory fact and say nothing about how a garment is
 *    made, so they are read from the design's own style rather than written per row.
 */

/** The sport group of a starter whose group is not the one its `sport` column names. */
const SPORT_TAG_OVERRIDES: Readonly<Record<string, readonly SportTag[]>> = {
  "black-purple-esports-jersey": ["esports"],
  "purple-sky-esports-fade-jersey": ["esports"],
  "black-green-esports-sponsor-jersey": ["esports"],
  "black-maroon-rash-guard": ["combat"],
  "navy-gold-rash-guard": ["combat"],
};

/** The group of `07` each value of the `sport` column belongs to. `general` is in none of the six. */
const SPORT_TAGS_BY_SPORT: Readonly<Record<Sport, readonly SportTag[]>> = {
  football: ["football"],
  cricket: ["cricket"],
  training: ["training"],
  running: ["running-gym"],
  general: [],
};

const ERA_BY_STYLE: Readonly<Record<StyleId, readonly EraTag[]>> = {
  plain: ["classic"],
  hoops: ["classic"],
  stripes: ["classic"],
  pinstripes: ["classic"],
  sash: ["retro-90s"],
  "side-panels": ["modern"],
  "chest-band": ["retro-90s"],
  fade: ["modern"],
  dots: ["retro-90s"],
};

const MOOD_BY_STYLE: Readonly<Record<StyleId, readonly MoodTag[]>> = {
  plain: ["clean"],
  hoops: ["bold"],
  stripes: ["bold"],
  pinstripes: ["understated"],
  sash: ["sharp"],
  "side-panels": ["sharp"],
  "chest-band": ["bold"],
  fade: ["bold"],
  dots: ["playful"],
};

export const sportTagsOf = (seed: Pick<SeedTemplate, "slug" | "sport">): readonly SportTag[] =>
  SPORT_TAG_OVERRIDES[seed.slug] ?? SPORT_TAGS_BY_SPORT[seed.sport];

/** Every tag a starter carries, in the shape a filter and a search read (`kinds/tags.ts`). */
export const tagsOf = (seed: SeedTemplate): TemplateTags => ({
  sport: sportTagsOf(seed),
  style: seed.styleTags,
  era: ERA_BY_STYLE[seed.style],
  mood: MOOD_BY_STYLE[seed.style],
  colour: seed.colourFamily,
});
