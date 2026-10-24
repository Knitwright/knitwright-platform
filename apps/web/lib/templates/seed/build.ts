import { applyAction, createSpec, type GarmentSpec, type Wearer } from "@/lib/garment";
import { kitStyleActions, type ClubColours } from "@/lib/kit-styles/presets";
import { sizingFromChart } from "@/lib/sizing";
import type { ReviewState, Sport, StyleId } from "../catalogue";
import { colourFamilyOf, type ColourFamily } from "../colour-family";

/**
 * The twelve starter templates, built from existing articles and kit styles. Nothing here is
 * from a factory: each is a Knitwright starter, not reviewed by a factory. Built the same way every
 * time (no date, no random id), so the same code gives the same rows.
 */

export interface SeedTemplate {
  readonly slug: string;
  readonly title: string;
  readonly sport: Sport;
  readonly articleId: string;
  readonly wearer: Wearer;
  readonly style: StyleId;
  readonly styleTags: readonly StyleId[];
  readonly colourFamily: ColourFamily;
  readonly reviewState: ReviewState;
  readonly snapshot: GarmentSpec;
}

export type Plan = Readonly<{
  slug: string;
  title: string;
  sport: Sport;
  articleId: string;
  wearer: Wearer;
  style: StyleId;
  colours: ClubColours;
}>;

const NAVY = "#1b2a49";
const GOLD = "#d4af37";
const WHITE = "#ffffff";
const BLACK = "#111111";
const colours = (main: string, second: string, third: string | null = null): ClubColours => ({ main, second, third });

const PLANS: readonly Plan[] = [
  { slug: "navy-gold-hoops", title: "Navy and gold hoops", sport: "football", articleId: "team-jersey", wearer: "men", style: "hoops", colours: colours(NAVY, GOLD) },
  { slug: "red-white-stripes", title: "Red and white stripes", sport: "football", articleId: "team-jersey", wearer: "men", style: "stripes", colours: colours("#c8102e", WHITE) },
  { slug: "sky-blue-sash", title: "Sky blue sash", sport: "football", articleId: "team-jersey", wearer: "men", style: "sash", colours: colours("#6cabdd", WHITE) },
  { slug: "green-gold-chest-band", title: "Green and gold chest band", sport: "football", articleId: "team-jersey", wearer: "women", style: "chest-band", colours: colours("#00843d", GOLD) },
  { slug: "maroon-gold-side-panels", title: "Maroon and gold side panels", sport: "cricket", articleId: "team-jersey", wearer: "men", style: "side-panels", colours: colours("#7a1f2b", GOLD) },
  { slug: "royal-white-polo", title: "Royal blue polo", sport: "cricket", articleId: "polo", wearer: "men", style: "plain", colours: colours("#1f4fbf", WHITE) },
  { slug: "navy-sky-pinstripe-polo", title: "Navy pinstripe polo", sport: "general", articleId: "polo", wearer: "women", style: "pinstripes", colours: colours(NAVY, "#6cabdd") },
  { slug: "orange-fade-training-tee", title: "Orange fade training tee", sport: "training", articleId: "crew-tee", wearer: "men", style: "fade", colours: colours("#e86a10", "#f6d330") },
  { slug: "purple-white-stripe-tee", title: "Purple and white stripe tee", sport: "training", articleId: "crew-tee", wearer: "women", style: "stripes", colours: colours("#5b2c83", WHITE) },
  { slug: "black-yellow-hoop-run-top", title: "Black and yellow hoop run top", sport: "running", articleId: "long-sleeve-tee", wearer: "men", style: "hoops", colours: colours(BLACK, "#f6d330") },
  { slug: "bottle-green-chest-band-tee", title: "Bottle green chest band tee", sport: "training", articleId: "v-neck-tee", wearer: "men", style: "chest-band", colours: colours("#0b3d2e", GOLD) },
  { slug: "black-white-pinstripe-jersey", title: "Black and white pinstripe jersey", sport: "general", articleId: "team-jersey", wearer: "men", style: "pinstripes", colours: colours(BLACK, WHITE) },
];

export const SEED_COUNT = PLANS.length;

export function snapshotFor(plan: Plan): GarmentSpec {
  const created = createSpec(plan.articleId, plan.wearer);
  if (!created.ok) throw new Error(`${plan.slug}: ${created.reason}`);
  // The same starting point as a new design: the sizes of the starter chart, nothing else made up.
  const sized = sizingFromChart(created.spec);
  const started = sized.ok ? applyAction(created.spec, sized.action) : created;
  if (!started.ok) throw new Error(`${plan.slug}: ${started.reason}`);
  const planned = kitStyleActions(started.spec, plan.style, plan.colours);
  if (!planned.ok) throw new Error(`${plan.slug}: ${planned.reason}`);
  return planned.actions.reduce<GarmentSpec>((spec, action) => {
    const applied = applyAction(spec, action);
    if (!applied.ok) throw new Error(`${plan.slug}: ${applied.reason}`);
    return applied.spec;
  }, started.spec);
}

export function buildSeedTemplates(plans: readonly Plan[] = PLANS): readonly SeedTemplate[] {
  return plans.map((plan) => {
    const family = colourFamilyOf(plan.colours.main);
    if (!family) throw new Error(`${plan.slug}: the main colour is not a swatch.`);
    return {
      slug: plan.slug,
      title: plan.title,
      sport: plan.sport,
      articleId: plan.articleId,
      wearer: plan.wearer,
      style: plan.style,
      styleTags: [plan.style],
      colourFamily: family,
      reviewState: "not_reviewed",
      snapshot: snapshotFor(plan),
    };
  });
}
