import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import { REVIEW_LABELS, type Sport } from "../../catalogue";
import type { ColourFamily } from "../../colour-family";
import type { EraTag, MoodTag, SportTag } from "../../kinds/tags";
import { allSeedTemplates } from "../all";
import type { SeedTemplate } from "../build";
import { tagsOf } from "../tagging";
import { BUNDLE_PLANS, type BundlePlan, type BundleRole, type BundleSlot } from "./plans";

/**
 * The kit bundles of `07`, built from the design templates themselves (plan v5 L8, decision 0098).
 *
 * A bundle holds nothing of its own that a design already holds: its sport, its colour family and its
 * tags are its lead member's, so a bundle can never disagree with the designs in it. A member that
 * names no design in the library is an error here rather than a row the database would refuse.
 */

/** What a bundle has no design for, with the rule that explains it. */
export interface BundleGap {
  readonly part: string;
  readonly line: string;
  /** `R-GAP-000`: no rulebook entry says why socks are not a base article; it is listed in the pull request. */
  readonly ruleId: string;
}

/**
 * `07` asks a bundle for a sock colour. The catalogue maps no base article to socks (decision 0066),
 * so there is no sock design template to put in a bundle, and inventing one would put a garment in a
 * kit that nothing can make.
 */
export const SOCKS_GAP: BundleGap = {
  part: "socks",
  line: "No socks in this bundle yet: socks are not one of the eight base articles",
  ruleId: GAP_RULE_ID,
};

export interface BundleMember {
  readonly templateSlug: string;
  readonly role: BundleRole;
  readonly slot: BundleSlot;
  readonly position: number;
}

export interface SeedBundle {
  readonly slug: string;
  readonly title: string;
  readonly sport: Sport;
  readonly colourFamily: ColourFamily;
  readonly sportTags: readonly SportTag[];
  readonly eraTags: readonly EraTag[];
  readonly moodTags: readonly MoodTag[];
  readonly label: string;
  readonly gaps: readonly BundleGap[];
  readonly members: readonly BundleMember[];
}

const bySlug = (designs: readonly SeedTemplate[]): ReadonlyMap<string, SeedTemplate> => new Map(designs.map((seed) => [seed.slug, seed]));

function buildOne(plan: BundlePlan, designs: ReadonlyMap<string, SeedTemplate>): SeedBundle {
  if (plan.members.length === 0) throw new Error(`${plan.slug}: a bundle needs at least one design.`);
  const found = plan.members.map((entry) => {
    const design = designs.get(entry.templateSlug);
    if (design === undefined) throw new Error(`${plan.slug}: no design template is called "${entry.templateSlug}".`);
    return design;
  });
  const lead = found[0]!;
  const tags = tagsOf(lead);
  return {
    slug: plan.slug,
    title: plan.title,
    sport: lead.sport,
    colourFamily: lead.colourFamily,
    sportTags: tags.sport,
    eraTags: tags.era,
    moodTags: tags.mood,
    label: REVIEW_LABELS.not_reviewed,
    gaps: [SOCKS_GAP],
    members: plan.members.map((entry, index) => ({ ...entry, position: index + 1 })),
  };
}

/** Every kit bundle, built the same way every time. */
export const buildBundles = (plans: readonly BundlePlan[] = BUNDLE_PLANS, designs: readonly SeedTemplate[] = allSeedTemplates()): readonly SeedBundle[] =>
  plans.map((plan) => buildOne(plan, bySlug(designs)));

/** The row `template_kit_bundles` stores. */
export const bundleRowOf = (bundle: SeedBundle) => ({
  slug: bundle.slug,
  title: bundle.title,
  sport: bundle.sport,
  colour_family: bundle.colourFamily,
  sport_tags: [...bundle.sportTags],
  era_tags: [...bundle.eraTags],
  mood_tags: [...bundle.moodTags],
  label: bundle.label,
  gaps: bundle.gaps.map((gap) => ({ part: gap.part, line: gap.line, rule_id: gap.ruleId })),
  source: "knitwright",
});

/** The rows `template_kit_bundle_members` stores for one bundle. */
export const memberRowsOf = (bundle: SeedBundle) =>
  bundle.members.map((entry) => ({
    bundle_slug: bundle.slug,
    template_slug: entry.templateSlug,
    role: entry.role,
    slot: entry.slot,
    position: entry.position,
  }));
