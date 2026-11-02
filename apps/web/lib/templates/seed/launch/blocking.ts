import { applyAction, createSpec, panelsFor, type Colourway, type GarmentSpec, type SpecAction, type Wearer } from "@/lib/garment";
import { sizingFromChart } from "@/lib/sizing";
import type { Sport } from "../../catalogue";
import { colourFamilyOf } from "../../colour-family";
import type { SeedTemplate } from "../build";

/**
 * Colour-blocked starters for the launch articles whose drawing carries no kit pattern: the teamwear
 * shirts and shorts, the hoodies, the training shorts and the compression top (plan v5 L8,
 * decision 0098). Nothing here is from a factory: each is a Knitwright starter, not reviewed by a
 * factory. Built the same way every time (no date, no random id), so the same code gives the same rows.
 *
 * Manufacturable by construction (spec decision 5): every option set below is a choice the article's
 * own registry entry offers, and no measurement is set — seven of the eight launch articles publish
 * none (decision 0090), so a starter takes the article's starter size chart where it has one and
 * nothing at all where it does not. The same shape as `seed/teamwear/build.ts`, which this extends to
 * the panels of the outerwear, bottoms and close-fitting families.
 */

export type BlockPlan = Readonly<{
  slug: string;
  title: string;
  sport: Sport;
  articleId: string;
  wearer: Wearer;
  /** The main colour: body of a top, legs of shorts and trousers, outside of a hood. */
  body: string;
  /** Trims: collar, neckband, cuffs, waistband, bindings, hem band, side panels and side stripes. */
  trim: string;
  /** A different colour for the sleeves, when the garment has contrast sleeves. */
  sleeves?: string;
  options: Readonly<Record<string, string>>;
}>;

/** Panels that take the main colour. A hood and a kangaroo pocket are cut from the body fabric. */
const BODY_PANELS = ["body-front", "body-back", "legs-front", "legs-back", "hood", "kangaroo-pocket"] as const;
const SLEEVE_PANELS = ["sleeve-left", "sleeve-right"] as const;
/** Panels that take the trim colour. Each is a real panel of one of the five families. */
const TRIM_PANELS = ["neckband", "collar", "cuffs", "side-panels", "waistband", "side-stripes", "binding", "hem-band", "hood-lining", "gusset"] as const;

function colourwayFor(spec: GarmentSpec, entry: BlockPlan): Colourway {
  const present = new Set(panelsFor(spec).map((panel) => panel.id));
  const wanted: [string, string][] = [
    ...BODY_PANELS.map((id): [string, string] => [id, entry.body]),
    ...SLEEVE_PANELS.map((id): [string, string] => [id, entry.sleeves ?? entry.body]),
    ...TRIM_PANELS.map((id): [string, string] => [id, entry.trim]),
  ];
  const colours = wanted
    .filter(([id]) => present.has(id))
    .map(([panelId, swatch]) => ({ panelId, colour: "", swatch, provenance: "user-edited" as const }));
  return { ...spec.colourways[0]!, colours };
}

function step(spec: GarmentSpec, action: SpecAction, slug: string): GarmentSpec {
  const applied = applyAction(spec, action);
  if (!applied.ok) throw new Error(`${slug}: ${applied.reason}`);
  return applied.spec;
}

export function blockSnapshot(entry: BlockPlan): GarmentSpec {
  const created = createSpec(entry.articleId, entry.wearer);
  if (!created.ok) throw new Error(`${entry.slug}: ${created.reason}`);
  // Sizes come from a starter chart only when the article has one; nothing is made up.
  const sized = sizingFromChart(created.spec);
  const started = sized.ok ? step(created.spec, sized.action, entry.slug) : created.spec;
  const optioned = Object.entries(entry.options).reduce<GarmentSpec>(
    (spec, [optionId, choiceId]) => step(spec, { type: "set-option", optionId, choiceId, provenance: "user-edited" }, entry.slug),
    started,
  );
  return step(optioned, { type: "update-colourway", colourway: colourwayFor(optioned, entry) }, entry.slug);
}

/** The starters of these plans, each carrying the "plain" style tag: a colour block is not a kit pattern. */
export function buildBlockSeeds(plans: readonly BlockPlan[]): readonly SeedTemplate[] {
  return plans.map((entry) => {
    const family = colourFamilyOf(entry.body);
    if (!family) throw new Error(`${entry.slug}: the body colour is not a swatch.`);
    return {
      slug: entry.slug,
      title: entry.title,
      sport: entry.sport,
      articleId: entry.articleId,
      wearer: entry.wearer,
      style: "plain",
      styleTags: ["plain"],
      colourFamily: family,
      reviewState: "not_reviewed",
      snapshot: blockSnapshot(entry),
    };
  });
}
