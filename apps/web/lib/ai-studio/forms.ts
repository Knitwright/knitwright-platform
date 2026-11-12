import { CAMPAIGN_LABELS, CAMPAIGN_STYLES, CAMPAIGNS, DESTINATION_LABELS, DESTINATIONS, STYLE_LABELS } from "@/lib/marketing/campaign/steps";
import { MODEL_CATALOGUE as VIDEO_MODELS } from "@/lib/media/video/models";
import { PRESETS as VIDEO_PRESETS } from "@/lib/media/video/prompt-presets";
import { ALL_SHOOT_CONCEPTS } from "@/lib/shoots/concepts";
import { MODEL_PRESET_CATALOGUE } from "@/lib/shoots/models";
import { posesOf } from "@/lib/shoots/poses";
import { SHOOT_ASPECTS, SHOOT_STYLE_LABELS, SHOOT_STYLES } from "@/lib/shoots/types";

/**
 * THE FORMS OF THE CANVAS WORKFLOWS (`09` "AI workflows at launch", the numbered steps).
 *
 * Each form is data: its fields in order, every choice a list the platform already keeps (the
 * shoots' concepts, poses and model presets, the campaign form's campaigns, styles and
 * destinations, the video prompt presets). The page draws a form from this, and the server checks
 * the answers against the same list (`answers.ts`), so a choice the page did not offer is refused.
 */

export type Option = Readonly<{ value: string; label: string }>;

export type Field =
  | Readonly<{ kind: "product"; id: "product"; label: string }>
  | Readonly<{ kind: "choice"; id: string; label: string; options: readonly Option[]; initial: string }>
  | Readonly<{ kind: "text"; id: string; label: string; placeholder: string; max: number; required: boolean }>
  | Readonly<{ kind: "toggle"; id: string; label: string; hint: string }>
  | Readonly<{ kind: "date"; id: string; label: string }>
  | Readonly<{ kind: "fixed"; id: string; label: string; value: string }>;

export interface WorkflowForm {
  readonly fields: readonly Field[];
  /** The footer's image count: how many the person may ask for, or null when the workflow makes a set. */
  readonly count: Readonly<{ min: number; max: number }> | null;
}

const PRODUCT: Field = { kind: "product", id: "product", label: "Choose a product" };
const BRAND: Field = { kind: "toggle", id: "brand", label: "Apply your brand", hint: "Your colours and type styles, from your brand." };

const choice = (id: string, label: string, options: readonly Option[]): Field => ({ kind: "choice", id, label, options, initial: options[0]?.value ?? "" });
const optionsOf = <T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>): readonly Option[] => values.map((value) => ({ value, label: labels[value] }));
const text = (id: string, label: string, placeholder: string, required = true, max = 120): Field => ({ kind: "text", id, label, placeholder, max, required });

const SHOT_FORMATS: readonly Option[] = SHOOT_ASPECTS.filter((one) => one !== "match").map((value) => ({ value, label: value }));
const POST_FORMATS = (formats: readonly string[]): readonly Option[] =>
  formats.flatMap((value) => (DESTINATIONS as readonly string[]).includes(value) ? [{ value, label: DESTINATION_LABELS[value as keyof typeof DESTINATION_LABELS] }] : []);

/** The surfaces `09` names for the flat-lay studio. Written into the shoot's background words. */
export const SURFACES: readonly Option[] = [
  { value: "grass", label: "Grass" },
  { value: "concrete", label: "Concrete" },
  { value: "white", label: "White" },
  { value: "locker-room", label: "Locker room" },
];

/** The marketing layout and its formats behind each team-and-club post (`lib/marketing/templates/plans.ts`). */
export const TEAM_LAYOUTS: Readonly<Record<string, Readonly<{ layout: string; formats: readonly string[]; words: readonly Field[] }>>> = {
  "matchday-graphic": {
    layout: "matchday",
    formats: ["social-square-1-1", "story-9-16"],
    words: [text("headline", "Opponent", "Northfield Town"), text("body", "Where and when", "Home, Sat 3 pm")],
  },
  "new-signing": {
    layout: "new-signing",
    formats: ["social-square-1-1", "story-9-16"],
    words: [text("headline", "Player name", "Sam Okafor"), text("body", "Number", "9", true, 12)],
  },
  "fixtures-list": {
    layout: "fixtures-list",
    formats: ["social-post-4-5"],
    words: [text("headline", "Title", "Next fixtures"), text("body", "The games, one per line", "Sat 3 pm v Northfield Town", true, 400)],
  },
  "sponsor-thank-you": {
    layout: "sponsor-thank-you",
    formats: ["social-square-1-1", "hero-banner-16-9"],
    words: [text("headline", "Sponsor name", "Acme Motors"), text("body", "Your thanks", "Thank you for backing the club this season", false)],
  },
};

const teamForm = (id: string): WorkflowForm | null => {
  const team = TEAM_LAYOUTS[id];
  return team ? { fields: [PRODUCT, ...team.words, choice("format", "Format", POST_FORMATS(team.formats))], count: null } : null;
};

const FORMS: Readonly<Record<string, WorkflowForm>> = {
  "colourway-set": { fields: [PRODUCT], count: null },
  "resize-for-all-socials": { fields: [PRODUCT], count: null },
  "on-model-try-on": {
    fields: [
      { ...PRODUCT, label: "Choose product (garment locked)" },
      BRAND,
      choice("model", "Model preset", MODEL_PRESET_CATALOGUE.map((one) => ({ value: one.key, label: one.label }))),
      choice("scene", "Scene", ALL_SHOOT_CONCEPTS.map((one) => ({ value: one.slug, label: one.title }))),
      choice("pose", "Pose", posesOf("pose").map((one) => ({ value: one.key, label: one.label }))),
      choice("format", "Format", SHOT_FORMATS),
    ],
    count: { min: 1, max: 4 },
  },
  "flat-lay-studio": {
    fields: [PRODUCT, choice("surface", "Surface", SURFACES), choice("format", "Format", SHOT_FORMATS)],
    count: { min: 1, max: 4 },
  },
  "kit-launch-ad": {
    fields: [
      PRODUCT,
      BRAND,
      { kind: "fixed", id: "logo", label: "Logo or crest", value: "Your brand's crest, from your brand assets, when you have one." },
      text("highlight", "What do you want to highlight?", "Pre-orders close Friday", true, 80),
      choice("campaign", "Pick a campaign", optionsOf(CAMPAIGNS, CAMPAIGN_LABELS)),
      choice("style", "Pick a style", optionsOf(CAMPAIGN_STYLES, STYLE_LABELS)),
      choice("destination", "Destination", optionsOf(DESTINATIONS, DESTINATION_LABELS)),
    ],
    count: { min: 1, max: 4 },
  },
  "team-store-promo": {
    fields: [
      { ...PRODUCT, label: "Team store kit" },
      { kind: "date", id: "deadline", label: "Deadline" },
      choice("destination", "Destination", optionsOf(DESTINATIONS, DESTINATION_LABELS)),
    ],
    count: null,
  },
  "try-on-video": {
    fields: [PRODUCT, choice("model", "Model", VIDEO_MODELS.map((one) => ({ value: one.key, label: one.label }))), choice("setting", "Setting", VIDEO_PRESETS.map((one) => ({ value: one.key, label: one.label })))],
    count: null,
  },
  "shopify-listing-set": {
    fields: [PRODUCT, { kind: "fixed", id: "background", label: "Background", value: "White, as marketplaces ask, with a flat lay, a hanger and a ghost mannequin." }],
    count: null,
  },
};

/** The form of a canvas workflow, or null for one that is not drawn from this file. */
export const formOf = (workflowId: string): WorkflowForm | null => FORMS[workflowId] ?? teamForm(workflowId);

/** The image styles of the shoots, for the Browse styles drawer and the Image generator. */
export const IMAGE_STYLES: readonly Option[] = optionsOf(SHOOT_STYLES, SHOOT_STYLE_LABELS);
