import type { ClubColours } from "@/lib/kit-styles/presets";
import type { Plan } from "../build";
import type { BlockPlan } from "./blocking";
import { BLACK, BOTTLE, GOLD, GREEN, GREY, MAROON, NAVY, PURPLE, ROYAL, SKY, WHITE } from "./colours";

/**
 * The starters that take the library to the 60 design templates of `docs/spec/07-template-library.md`
 * (plan v5 L8, decision 0098). The first 33 are the v4 starters (`seed/build.ts`, `seed/teamwear/build.ts`);
 * these 27 fill the sport groups and base articles `07` lists and v4 had none of: the hoodies
 * (`HOD-ST-01`), the compression top and rash guard (`CMP-LS-01`), the training shorts (`SHO-TR-01`),
 * esports and running/gym on the jersey, and the football long sleeve (`JSY-LS-01`).
 *
 * Every row is data: an article of the registry, a wearer it offers, options it offers, a style its
 * drawing can draw, and a colour of the editor's own palette. Nothing here is a measurement, an
 * invented option code or a fabric code.
 *
 * Two of `07`'s sport groups are not in the `sport` column's five values. An esports or combat starter
 * is filed under `general` there and carries its real group in `sport_tags` (see `tagging.ts`), which
 * is the column the migration added for exactly this.
 */

const colours = (main: string, second: string, third: string | null = null): ClubColours => ({ main, second, third });

/**
 * Starters on the five garments whose drawing carries a kit pattern (`lib/garment/kit-pattern.ts`:
 * the tops family). The style is one of the eight the drawing can draw; `07` also names
 * half-and-half, chevron, retro-90s geometric and camo fade, which no style in the editor draws, so
 * none is seeded (see the pull request).
 */
export const LAUNCH_KIT_STYLE_PLANS: readonly Plan[] = [
  // Football, JSY-SS-01 (team jersey) and JSY-LS-01 (long sleeve).
  { slug: "royal-white-gradient-fade-jersey", title: "Royal blue gradient fade jersey", sport: "football", articleId: "team-jersey", wearer: "men", style: "fade", colours: colours(ROYAL, WHITE) },
  { slug: "white-navy-classic-jersey", title: "White classic jersey, navy trim", sport: "football", articleId: "team-jersey", wearer: "men", style: "plain", colours: colours(WHITE, NAVY) },
  { slug: "navy-gold-spot-jersey", title: "Navy jersey, gold spots", sport: "football", articleId: "team-jersey", wearer: "youth", style: "dots", colours: colours(NAVY, GOLD) },
  { slug: "navy-white-long-sleeve-hoops", title: "Navy long sleeve hoops", sport: "football", articleId: "long-sleeve-tee", wearer: "men", style: "hoops", colours: colours(NAVY, WHITE) },
  { slug: "black-maroon-long-sleeve-side-panels", title: "Black long sleeve, maroon side panels", sport: "football", articleId: "long-sleeve-tee", wearer: "women", style: "side-panels", colours: colours(BLACK, MAROON) },
  // Training, TEE-TR-01.
  { slug: "sky-white-chest-band-training-tee", title: "Training tee, sky blue chest band", sport: "training", articleId: "crew-tee", wearer: "men", style: "chest-band", colours: colours(SKY, WHITE) },
  { slug: "grey-black-coaches-v-neck-tee", title: "Coaches' V neck tee, black side panels", sport: "training", articleId: "v-neck-tee", wearer: "women", style: "side-panels", colours: colours(GREY, BLACK) },
  { slug: "black-gold-warm-up-tee", title: "Warm-up tee, black and gold hoops", sport: "training", articleId: "crew-tee", wearer: "youth", style: "hoops", colours: colours(BLACK, GOLD) },
  // Esports, JSY-SS-01. Filed under the general sport, tagged esports.
  { slug: "black-purple-esports-jersey", title: "Esports jersey, purple spots", sport: "general", articleId: "team-jersey", wearer: "men", style: "dots", colours: colours(BLACK, PURPLE) },
  { slug: "purple-sky-esports-fade-jersey", title: "Esports jersey, purple to sky blue fade", sport: "general", articleId: "team-jersey", wearer: "women", style: "fade", colours: colours(PURPLE, SKY) },
  { slug: "black-green-esports-sponsor-jersey", title: "Esports jersey, plain sponsor layout", sport: "general", articleId: "team-jersey", wearer: "men", style: "plain", colours: colours(BLACK, GREEN) },
  // Running and gym, JSY-SS-01 and TEE-TR-01.
  { slug: "grey-black-stripe-run-top", title: "Run top, grey and black stripes", sport: "running", articleId: "team-jersey", wearer: "women", style: "stripes", colours: colours(GREY, BLACK) },
  { slug: "sky-navy-gym-fade-tee", title: "Gym fade tee, sky blue to navy", sport: "running", articleId: "crew-tee", wearer: "women", style: "fade", colours: colours(SKY, NAVY) },
];

/** Starters on the garments whose drawing carries no kit pattern: colour blocking plus the article's own options. */
export const LAUNCH_BLOCK_PLANS: readonly BlockPlan[] = [
  // Football, JSY-SS-01 (football shirt) and SHO-TR-01 (football shorts).
  { slug: "white-maroon-band-collar-football-shirt", title: "White football shirt, maroon band collar", sport: "football", articleId: "football-shirt", wearer: "women", body: WHITE, trim: MAROON, options: { collar: "band-collar" } },
  { slug: "navy-gold-football-shorts", title: "Navy football shorts, gold waistband", sport: "football", articleId: "football-shorts", wearer: "youth", body: NAVY, trim: GOLD, options: {} },
  { slug: "royal-white-stripe-football-shorts", title: "Royal blue football shorts, white side stripe", sport: "football", articleId: "football-shorts", wearer: "men", body: ROYAL, trim: WHITE, options: { "side-stripe": "contrast-stripe" } },
  // Cricket, CRK-SS-01.
  { slug: "white-green-short-sleeve-cricket-shirt", title: "White cricket shirt, green trim, short sleeve", sport: "cricket", articleId: "cricket-shirt", wearer: "women", body: WHITE, trim: GREEN, options: { "sleeve-length": "short" } },
  { slug: "navy-gold-sleeve-cricket-shirt", title: "Navy cricket shirt, gold sleeves", sport: "cricket", articleId: "cricket-shirt", wearer: "men", body: NAVY, trim: GOLD, sleeves: GOLD, options: {} },
  // Training, HOD-ST-01 (hoodies) and SHO-TR-01 (training shorts).
  { slug: "navy-white-club-training-hoodie", title: "Club training hoodie, navy with white trim", sport: "training", articleId: "pullover-hoodie", wearer: "men", body: NAVY, trim: WHITE, options: { hood: "lined", pockets: "kangaroo", cuffs: "rib-cuff", "hem-finish": "rib-band" } },
  { slug: "black-grey-coaches-hoodie", title: "Coaches' hoodie, black with grey trim", sport: "training", articleId: "pullover-hoodie", wearer: "women", body: BLACK, trim: GREY, options: { hood: "single-layer", pockets: "side-seam", cuffs: "rib-cuff", "hem-finish": "rib-band" } },
  { slug: "royal-white-pre-match-zip-hoodie", title: "Pre-match zip hoodie, royal blue", sport: "training", articleId: "zip-hoodie", wearer: "men", body: ROYAL, trim: WHITE, options: { hood: "lined", pockets: "zip-side", cuffs: "rib-cuff", "hem-finish": "rib-band" } },
  { slug: "bottle-gold-warm-up-zip-hoodie", title: "Warm-up zip hoodie, bottle green and gold", sport: "training", articleId: "zip-hoodie", wearer: "women", body: BOTTLE, trim: GOLD, options: { hood: "single-layer", pockets: "side-seam", cuffs: "rib-cuff", "hem-finish": "hem" } },
  { slug: "grey-black-training-shorts", title: "Training shorts, grey with black side stripe", sport: "training", articleId: "shorts", wearer: "men", body: GREY, trim: BLACK, options: { waistband: "elastic-drawcord", "side-stripe": "contrast-stripe", pockets: "side-seam" } },
  // Running and gym, CMP-LS-01.
  { slug: "black-white-minimal-compression-top", title: "Compression top, black with white binding", sport: "running", articleId: "compression-top", wearer: "men", body: BLACK, trim: WHITE, options: { sleeves: "long", "edge-finish": "bound" } },
  { slug: "purple-black-short-sleeve-compression-top", title: "Compression top, purple with black sleeves", sport: "running", articleId: "compression-top", wearer: "women", body: PURPLE, trim: BLACK, sleeves: BLACK, options: { sleeves: "short", "edge-finish": "turned" } },
  // Combat, CMP-LS-01. Filed under the general sport, tagged combat.
  { slug: "black-maroon-rash-guard", title: "Rash guard, black with maroon binding", sport: "general", articleId: "compression-top", wearer: "men", body: BLACK, trim: MAROON, options: { sleeves: "long", "edge-finish": "bound" } },
  { slug: "navy-gold-rash-guard", title: "Rash guard, navy with gold binding", sport: "general", articleId: "compression-top", wearer: "women", body: NAVY, trim: GOLD, options: { sleeves: "long", "edge-finish": "bound" } },
];
