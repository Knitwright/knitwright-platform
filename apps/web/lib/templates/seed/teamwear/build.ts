import { applyAction, createSpec, panelsFor, type Colourway, type GarmentSpec, type SpecAction, type Wearer } from "@/lib/garment";
import { sizingFromChart } from "@/lib/sizing";
import type { Sport } from "../../catalogue";
import { colourFamilyOf } from "../../colour-family";
import type { SeedTemplate } from "../build";

/**
 * Starter templates for the football and cricket articles that have a flat. Nothing here is from a
 * factory: each is a Knitwright starter, not reviewed by a factory. Built the same way every time
 * (no date, no random id). No measurement is set: the garments have no starter size chart.
 *
 * Kit patterns are drawn on tops only (lib/garment/kit-pattern.ts), and a football or cricket
 * article is not in the tops family, so these starters are colour blocking plus the article's real
 * options, and carry the "plain" style tag.
 */

export type TeamwearPlan = Readonly<{
  slug: string;
  title: string;
  articleId: string;
  wearer: Wearer;
  /** The main colour: body of a top, legs of shorts and trousers. */
  body: string;
  /** Trims: collar, neckband, cuffs, waistband, side panels and side stripes. */
  trim: string;
  /** A different colour for the sleeves, when the shirt has contrast sleeves. */
  sleeves?: string;
  options: Readonly<Record<string, string>>;
}>;

const NAVY = "#1b2a49";
const GOLD = "#d4af37";
const WHITE = "#ffffff";
const BLACK = "#111111";
const RED = "#c8102e";
const ROYAL = "#1f4fbf";
const SKY = "#6cabdd";
const GREEN = "#00843d";
const BOTTLE = "#0b3d2e";
const MAROON = "#7a1f2b";
const ORANGE = "#e86a10";
const YELLOW = "#f6d330";
const GREY = "#8a8d91";

const plan = (slug: string, title: string, articleId: string, wearer: Wearer, body: string, trim: string, options: Record<string, string> = {}, sleeves?: string): TeamwearPlan => ({
  slug, title, articleId, wearer, body, trim, options, ...(sleeves ? { sleeves } : {}),
});

const PLANS: readonly TeamwearPlan[] = [
  plan("red-white-football-shirt", "Red football shirt, white trim", "football-shirt", "men", RED, WHITE, { neckline: "v-neck" }),
  plan("royal-white-sleeve-football-shirt", "Royal blue football shirt, white sleeves", "football-shirt", "women", ROYAL, WHITE, {}, WHITE),
  plan("black-gold-strip-football-shirt", "Black football shirt, gold side strips", "football-shirt", "men", BLACK, GOLD, { "side-panels": "contrast-insert" }),
  plan("white-navy-stripe-football-shorts", "White football shorts, navy side stripe", "football-shorts", "men", WHITE, NAVY, { "side-stripe": "contrast-stripe" }),
  plan("black-gold-football-shorts", "Black football shorts, gold waistband", "football-shorts", "women", BLACK, GOLD),
  plan("red-white-stripe-football-shorts", "Red youth football shorts, white side stripe", "football-shorts", "youth", RED, WHITE, { "side-stripe": "contrast-stripe" }),
  plan("yellow-keeper-shirt", "Yellow goalkeeper shirt, padded elbows", "goalkeeper-shirt", "men", YELLOW, BLACK, { "elbow-pads": "padded-elbows" }),
  plan("green-black-keeper-shirt", "Green goalkeeper shirt, black sleeves", "goalkeeper-shirt", "women", GREEN, BLACK, { "elbow-pads": "padded-elbows" }, BLACK),
  plan("sky-band-collar-keeper-shirt", "Sky blue goalkeeper shirt, band collar", "goalkeeper-shirt", "men", SKY, NAVY, { collar: "band-collar" }),
  plan("grey-zip-football-training-top", "Grey football training top, zip", "football-training-top", "men", GREY, BLACK, { placket: "zip" }),
  plan("navy-raglan-football-training-top", "Navy football training top, raglan sleeves", "football-training-top", "women", NAVY, SKY, { "sleeve-type": "raglan" }),
  plan("orange-football-training-top", "Orange football training top, black sleeves", "football-training-top", "youth", ORANGE, BLACK, {}, BLACK),
  plan("royal-button-cricket-shirt", "Royal blue cricket shirt, buttons", "cricket-shirt", "men", ROYAL, WHITE, { placket: "buttons" }),
  plan("maroon-zip-cricket-shirt", "Maroon cricket shirt, zip", "cricket-shirt", "men", MAROON, GOLD, { placket: "zip" }),
  plan("sky-short-sleeve-cricket-shirt", "Sky blue short sleeve cricket shirt", "cricket-shirt", "women", SKY, NAVY, { "sleeve-length": "short" }),
  plan("navy-cricket-trousers", "Navy cricket trousers", "cricket-trousers", "men", NAVY, WHITE, { "leg-length": "full" }),
  plan("bottle-green-stripe-cricket-trousers", "Bottle green cricket trousers, gold side stripe", "cricket-trousers", "men", BOTTLE, GOLD, { "side-stripe": "contrast-stripe", "leg-length": "full" }),
  plan("maroon-zip-pocket-cricket-trousers", "Maroon cricket trousers, zipped pockets", "cricket-trousers", "women", MAROON, GOLD, { pockets: "zip-side", "leg-length": "full" }),
  plan("white-crew-cricket-training-tee", "White cricket training tee, navy trim", "cricket-training-tee", "men", WHITE, NAVY),
  plan("green-v-neck-cricket-training-tee", "Green cricket training tee, V neck", "cricket-training-tee", "women", GREEN, GOLD, { neckline: "v-neck" }),
  plan("orange-raglan-cricket-training-tee", "Orange cricket training tee, black raglan sleeves", "cricket-training-tee", "youth", ORANGE, BLACK, { "sleeve-type": "raglan" }, BLACK),
];

/** The articles that have starters, in the order the plan lists them. */
export const TEAMWEAR_SEED_ARTICLES: readonly string[] = [...new Set(PLANS.map((entry) => entry.articleId))];

const BODY_PANELS = ["body-front", "body-back", "legs-front", "legs-back"] as const;
const SLEEVE_PANELS = ["sleeve-left", "sleeve-right"] as const;
const TRIM_PANELS = ["neckband", "collar", "cuffs", "side-panels", "waistband", "side-stripes"] as const;

const sportOf = (articleId: string): Sport => (articleId.startsWith("cricket") ? "cricket" : "football");

function colourwayFor(spec: GarmentSpec, entry: TeamwearPlan): Colourway {
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

export function teamwearSnapshot(entry: TeamwearPlan): GarmentSpec {
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

export function buildTeamwearSeeds(plans: readonly TeamwearPlan[] = PLANS): readonly SeedTemplate[] {
  return plans.map((entry) => {
    const family = colourFamilyOf(entry.body);
    if (!family) throw new Error(`${entry.slug}: the body colour is not a swatch.`);
    return {
      slug: entry.slug,
      title: entry.title,
      sport: sportOf(entry.articleId),
      articleId: entry.articleId,
      wearer: entry.wearer,
      style: "plain",
      styleTags: ["plain"],
      colourFamily: family,
      reviewState: "not_reviewed",
      snapshot: teamwearSnapshot(entry),
    };
  });
}
