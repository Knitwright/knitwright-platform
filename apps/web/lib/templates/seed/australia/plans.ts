import type { Plan } from "../build";
import type { BlockPlan } from "../launch/blocking";
import { GOLD, GREEN, MAROON, NAVY, PURPLE, WHITE } from "../launch/colours";
import type { ClubColours } from "@/lib/kit-styles/presets";

/**
 * The starters for the Australian market: Australian football, netball and cricket
 * (`docs/spec/06-build-plan.md` phase 3 item 13; plan v5 O3, decision 0103).
 *
 * These are **beside** the 60 design templates of `docs/spec/07-template-library.md`, not part of them:
 * `07`'s table and its launch count are a UK-first library and L8 filled them exactly (decision 0098).
 * `allSeedTemplates()` is still those 60, and `seed.ts` writes these eight as well.
 *
 * Two gaps are named rather than filled in:
 *
 *   1. **No garment for either sport.** An Australian football guernsey is sleeveless and a netball
 *      dress is a dress; the registry has neither, and `06-build-plan` lists a netball dress under
 *      "more base articles" for later. So these starters sit on the garments that do exist — the team
 *      jersey, the V-neck and crew tees and the shorts — and their titles say which sport they are for.
 *      Drawing a guernsey or a dress would mean inventing a block nobody has drafted.
 *   2. **No sport tag for either sport.** `07`'s closed tag set is football, cricket, training, esports,
 *      running / gym and combat; neither Australian football nor netball is one of them, and widening a
 *      vocabulary another workstream owns to hold them is not this one's to do. The cricket starters
 *      carry the cricket tag; the other six carry none, exactly as the esports and combat starters did
 *      before a tag existed for them, and the pull request names it as an owner question.
 *
 * Every row is data: an article of the registry, a wearer it offers, options it offers, a style its
 * drawing can draw, and a colour of the editor's own palette. Nothing here is a measurement.
 */

const colours = (main: string, second: string): ClubColours => ({ main, second, third: null });

/** Starters on the garments whose drawing carries a kit pattern. */
export const AUSTRALIA_KIT_STYLE_PLANS: readonly Plan[] = [
  // Australian football. Filed under the general sport: see the note above.
  {
    slug: "afl-navy-gold-club-jersey",
    title: "Australian football club jersey, navy with a gold chest band",
    sport: "general",
    articleId: "team-jersey",
    wearer: "men",
    style: "chest-band",
    colours: colours(NAVY, GOLD),
  },
  {
    slug: "afl-maroon-white-club-jersey",
    title: "Australian football club jersey, maroon with a white sash",
    sport: "general",
    articleId: "team-jersey",
    wearer: "women",
    style: "sash",
    colours: colours(MAROON, WHITE),
  },
  // Netball.
  {
    slug: "netball-purple-white-top",
    title: "Netball top, purple with white side panels",
    sport: "general",
    articleId: "v-neck-tee",
    wearer: "women",
    style: "side-panels",
    colours: colours(PURPLE, WHITE),
  },
  {
    slug: "netball-green-gold-top",
    title: "Netball top, green and gold hoops",
    sport: "general",
    articleId: "crew-tee",
    wearer: "youth",
    style: "hoops",
    colours: colours(GREEN, GOLD),
  },
];

/** Starters on the garments whose drawing carries no kit pattern: colour blocking and the article's options. */
export const AUSTRALIA_BLOCK_PLANS: readonly BlockPlan[] = [
  // Australian football and netball shorts, on the training shorts block.
  {
    slug: "afl-navy-gold-club-shorts",
    title: "Australian football club shorts, navy with a gold side stripe",
    sport: "general",
    articleId: "shorts",
    wearer: "men",
    body: NAVY,
    trim: GOLD,
    options: { waistband: "elastic-drawcord", "side-stripe": "contrast-stripe", pockets: "side-seam" },
  },
  {
    slug: "netball-purple-white-shorts",
    title: "Netball shorts, purple with a white side stripe",
    sport: "general",
    articleId: "shorts",
    wearer: "women",
    body: PURPLE,
    trim: WHITE,
    options: { waistband: "elastic-drawcord", "side-stripe": "contrast-stripe", pockets: "side-seam" },
  },
  // Australian club cricket, on CRK-SS-01.
  {
    slug: "au-cricket-white-navy-shirt",
    title: "Australian club cricket shirt, white with navy trim",
    sport: "cricket",
    articleId: "cricket-shirt",
    wearer: "men",
    body: WHITE,
    trim: NAVY,
    options: { "sleeve-length": "short" },
  },
  {
    slug: "au-cricket-green-gold-shirt",
    title: "Australian club cricket shirt, green with gold sleeves",
    sport: "cricket",
    articleId: "cricket-shirt",
    wearer: "women",
    body: GREEN,
    trim: GOLD,
    sleeves: GOLD,
    options: {},
  },
];

/** What the library still has no garment for, each with the rule that explains it. */
export const AUSTRALIA_GAPS: readonly Readonly<{ note: string; ruleId: string }>[] = [
  {
    note: "An Australian football guernsey is sleeveless and the registry has no sleeveless top, so these starters are on the team jersey.",
    ruleId: "R-GAP-000",
  },
  {
    note: "A netball dress is listed under more base articles for later (docs/spec/06-build-plan.md), so these starters are on the tees and the shorts.",
    ruleId: "R-GAP-000",
  },
  {
    note: "Neither Australian football nor netball is one of the six sport groups of docs/spec/07-template-library.md, so neither carries a sport tag.",
    ruleId: "R-GAP-000",
  },
];
