import { MARKETING_RULE } from "../rules";

/**
 * THE CAMPAIGN WORKFLOW FORM (spec F-L2 "2. Campaign workflow form": the seven numbered steps,
 * with an output example on the right; plan v5 L4, decision 0094).
 *
 * The spec's seven steps, its nine campaigns, its six styles and its six destinations, written
 * once as data. The form is drawn from this: a step the spec does not name cannot appear, and a
 * campaign nobody asked for cannot either.
 *
 * The destinations are the keys of `launch_artboard_presets` (L1, decision 0091), so the size of a
 * destination is a row and never a number here -- including A4, whose resolution the preset carries.
 */

export const CAMPAIGN_STEPS = ["product", "brand", "logo", "highlight", "campaign", "style", "destination"] as const;
export type CampaignStep = (typeof CAMPAIGN_STEPS)[number];

export interface StepInfo {
  readonly id: CampaignStep;
  /** The number the spec gives the step, which the form shows. */
  readonly number: number;
  readonly label: string;
  /** One line under the label: what this step is for. */
  readonly lead: string;
  /** False for the steps the spec marks optional. */
  readonly required: boolean;
  readonly ruleId: string;
}

export const STEPS: readonly StepInfo[] = [
  { id: "product", number: 1, label: "Product", lead: "Pick a design version or a mockup. The garment in it stays exactly as it is.", required: true, ruleId: MARKETING_RULE },
  { id: "brand", number: 2, label: "Apply your brand", lead: "Your colours, your type styles and your voice, from Brand Studio.", required: true, ruleId: MARKETING_RULE },
  { id: "logo", number: 3, label: "Logo or crest", lead: "The mark that goes on the layout. Optional.", required: false, ruleId: MARKETING_RULE },
  { id: "highlight", number: 4, label: "What do you want to highlight?", lead: "In your own words, such as “Pre-orders close Friday” or “Names and numbers included”.", required: true, ruleId: MARKETING_RULE },
  { id: "campaign", number: 5, label: "Campaign", lead: "What this is for. It decides which layouts are offered.", required: true, ruleId: MARKETING_RULE },
  { id: "style", number: 6, label: "Style", lead: "How it should look. It changes the layout and the background, never the garment.", required: true, ruleId: MARKETING_RULE },
  { id: "destination", number: 7, label: "Destination", lead: "The size it is made at, from the artboard sizes a platform admin keeps.", required: true, ruleId: MARKETING_RULE },
];

/** The nine campaigns of the spec's step 5, in its order. */
export const CAMPAIGNS = [
  "new-kit-launch",
  "pre-order",
  "team-store-open",
  "last-chance",
  "restock",
  "matchday",
  "sale-promotion",
  "limited-drop",
  "sponsor-thank-you",
] as const;
export type Campaign = (typeof CAMPAIGNS)[number];

export const CAMPAIGN_LABELS: Readonly<Record<Campaign, string>> = {
  "new-kit-launch": "New kit launch",
  "pre-order": "Pre-order",
  "team-store-open": "Team store open",
  "last-chance": "Last chance",
  restock: "Restock",
  matchday: "Matchday",
  "sale-promotion": "Sale or promotion",
  "limited-drop": "Limited drop",
  "sponsor-thank-you": "Sponsor thank-you",
};

/** The six styles of the spec's step 6, which are image tiles in the form. */
export const CAMPAIGN_STYLES = ["matchday-poster", "editorial", "minimal", "badge-callout", "grid", "retro"] as const;
export type CampaignStyle = (typeof CAMPAIGN_STYLES)[number];

export const STYLE_LABELS: Readonly<Record<CampaignStyle, string>> = {
  "matchday-poster": "Matchday poster",
  editorial: "Editorial",
  minimal: "Minimal",
  "badge-callout": "Badge callout",
  grid: "Grid",
  retro: "Retro",
};

/**
 * The destinations of the spec's step 7, as the keys of `launch_artboard_presets`. The panel reads
 * the sizes from `LaunchContext.presets`; nothing here says how big any of them is.
 */
export const DESTINATIONS = ["story-9-16", "social-post-4-5", "social-square-1-1", "hero-banner-16-9", "pin-2-3", "a4-print"] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const DESTINATION_LABELS: Readonly<Record<Destination, string>> = {
  "story-9-16": "Story 9:16",
  "social-post-4-5": "Social post 4:5",
  "social-square-1-1": "Social square 1:1",
  "hero-banner-16-9": "Hero banner 16:9",
  "pin-2-3": "Pin 2:3",
  "a4-print": "A4 print",
};

/** The most characters the highlight takes. Knitwright's own figure; see MARKETING_GAPS. */
export const HIGHLIGHT_LIMIT = 140;

/** The most images one run of the form makes. The spec's footer shows an image count and the cost. */
export const MAX_IMAGE_COUNT = 4;

export const isCampaign = (value: string): value is Campaign => (CAMPAIGNS as readonly string[]).includes(value);
export const isCampaignStyle = (value: string): value is CampaignStyle => (CAMPAIGN_STYLES as readonly string[]).includes(value);
export const isDestination = (value: string): value is Destination => (DESTINATIONS as readonly string[]).includes(value);
