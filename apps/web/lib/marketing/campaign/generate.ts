import type { Size } from "@/lib/launch";
import { place, placementVerdict, type PlacedSlot } from "../layout";
import { MARKETING_RULE } from "../rules";
import { buildLayouts } from "../templates/plans";
import type { MarketingLayout } from "../templates/types";
import type { ReadyForm } from "./form";
import { CAMPAIGN_LABELS, STYLE_LABELS, type Campaign, type CampaignStyle } from "./steps";

/**
 * GENERATING LAYOUTS AROUND PIXEL-LOCKED MOCKUPS (spec F-L2: "AI here may restyle the layout and
 * background, but placed mockups stay pixel-locked"; plan v5 L4, decision 0094).
 *
 * The form's seven answers become artboards, here, deterministically: the campaign says which of
 * `07`'s layouts are for it, the style says which of those to offer first, the destination says how
 * big the artboard is (from a `launch_artboard_presets` row), and the layout's fractions become
 * rectangles on it.
 *
 * **No model is called.** The spec allows a model to restyle the layout and the background, and that
 * is a later change with a cost on the button; what is here is the free, repeatable version, and it
 * is what makes the acceptance test ("a 'new kit' post in 3 formats in under 5 minutes") pass with
 * no credits. The mockup's rectangle comes from the layout and is never moved to make room for
 * anything: `placementVerdict` refuses a layout that would cover it instead.
 */

/**
 * Which of `07`'s layouts each campaign offers. Every key is a layout of `plans.ts`, and
 * `generate.test.ts` holds that true, so a campaign can never offer a layout that does not exist.
 */
export const CAMPAIGN_LAYOUTS: Readonly<Record<Campaign, readonly string[]>> = {
  "new-kit-launch": ["new-kit-reveal", "home-away-split", "available-now-qr", "a4-poster"],
  "pre-order": ["pre-order-now", "new-kit-reveal", "order-your-kit", "noticeboard-qr-poster"],
  "team-store-open": ["order-your-kit", "size-reminder", "noticeboard-qr-poster", "a4-poster"],
  "last-chance": ["last-chance", "order-your-kit", "kit-countdown-1"],
  restock: ["restock", "drop-announcement", "listing-white"],
  matchday: ["matchday", "player-of-the-match", "result", "fixtures-list"],
  "sale-promotion": ["drop-announcement", "last-chance", "feature-callout-image", "flyer"],
  "limited-drop": ["drop-announcement", "kit-countdown-3", "founder-story", "product-feature"],
  "sponsor-thank-you": ["sponsor-thank-you", "web-banner", "a4-poster"],
};

/**
 * What each style asks for, as the shapes it prefers: the layouts a campaign offers are ordered by
 * how well they match. A style never changes a slot's rectangle, so it cannot move a mockup.
 */
export const STYLE_PREFERENCES: Readonly<Record<CampaignStyle, readonly string[]>> = {
  "matchday-poster": ["standout", "poster"],
  editorial: ["beside", "portrait"],
  minimal: ["plain", "hero"],
  "badge-callout": ["callouts", "scanable"],
  grid: ["split", "callouts"],
  retro: ["written", "hero"],
};

/** The shape of a layout, named by the ids of its slots, so a style can prefer one without new data. */
const shapeOf = (layout: MarketingLayout): string => {
  const ids = layout.slots.map((one) => one.id);
  if (ids.includes("mockup-2")) return "split";
  if (ids.includes("callout-1")) return "callouts";
  if (ids.includes("qr")) return ids.includes("body") ? "poster" : "scanable";
  if (ids.length === 2) return "plain";
  if (ids.includes("body")) return ids.includes("subheadline") ? "beside" : "written";
  const headline = layout.slots.find((one) => one.id === "headline");
  const mockup = layout.slots.find((one) => one.id === "mockup");
  if (headline && mockup && headline.rect.y < mockup.rect.y) return "standout";
  return mockup && mockup.rect.y <= 0.16 ? "portrait" : "hero";
};

/** One artboard the form would produce. */
export interface GeneratedArtboard {
  readonly layoutKey: string;
  readonly title: string;
  /** What the panel says this artboard is, in the form's own words. */
  readonly lead: string;
  readonly size: Size;
  readonly slots: readonly PlacedSlot[];
}

export type GenerateVerdict =
  | Readonly<{ ok: true; artboards: readonly GeneratedArtboard[] }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): GenerateVerdict => ({ ok: false, reason, ruleId: MARKETING_RULE });

/** The layouts a campaign offers, ordered by how well each matches the style. */
export function layoutsFor(form: ReadyForm, layouts: readonly MarketingLayout[] = buildLayouts()): readonly MarketingLayout[] {
  const wanted = CAMPAIGN_LAYOUTS[form.campaign];
  const preferred = STYLE_PREFERENCES[form.style];
  const chosen = wanted.flatMap((key) => layouts.filter((layout) => layout.key === key));
  const rank = (layout: MarketingLayout): number => {
    const index = preferred.indexOf(shapeOf(layout));
    return index === -1 ? preferred.length : index;
  };
  return [...chosen].sort((a, b) => rank(a) - rank(b) || wanted.indexOf(a.key) - wanted.indexOf(b.key));
}

/**
 * The artboards the form's answers produce, at the destination's own size, or why none could be
 * made. The same answers give the same artboards every time: nothing here is random and no model
 * is called.
 */
export function generate(form: ReadyForm, size: Size, layouts: readonly MarketingLayout[] = buildLayouts()): GenerateVerdict {
  const chosen = layoutsFor(form, layouts).slice(0, form.imageCount);
  if (chosen.length === 0) return refuse(`No layout is on file for ${CAMPAIGN_LABELS[form.campaign]} yet.`);
  const artboards: GeneratedArtboard[] = [];
  for (const layout of chosen) {
    const verdict = placementVerdict(layout.slots);
    if (!verdict.ok) return refuse(`${layout.title}: ${verdict.reason}`);
    artboards.push({
      layoutKey: layout.key,
      title: layout.title,
      lead: `${CAMPAIGN_LABELS[form.campaign]}, ${STYLE_LABELS[form.style].toLowerCase()}. ${layout.lead}`,
      size,
      slots: place(layout.slots, size),
    });
  }
  return { ok: true, artboards };
}

/** The mockup rectangles of a generated artboard: the pictures nothing may move or cover. */
export const lockedAreas = (artboard: GeneratedArtboard): readonly PlacedSlot[] => artboard.slots.filter((one) => one.slot.pixelLocked);
