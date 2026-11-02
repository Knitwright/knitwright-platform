import { MARKETING_RULE } from "../rules";
import {
  CAMPAIGN_STEPS,
  HIGHLIGHT_LIMIT,
  MAX_IMAGE_COUNT,
  STEPS,
  type Campaign,
  type CampaignStep,
  type CampaignStyle,
  type Destination,
} from "./steps";

/**
 * THE FORM'S OWN STATE (spec F-L2 "2. Campaign workflow form"; plan v5 L4, decision 0094).
 *
 * The seven steps as one value, what each step still needs, and whether the footer's Generate may
 * be pressed. The component holds markup and wiring only, so the rules are testable without a
 * browser and the form can never offer to generate something it could not.
 *
 * The product is a **board of the launch canvas** -- a design board or a mockup board -- or a
 * photograph the person uploaded. In every case the picture is one that already exists: this form
 * never asks for a garment to be drawn, and the generated layout is built **around** it.
 */

/** Where the picture in the layout comes from. Each one is a picture that already exists. */
export const PRODUCT_SOURCES = ["design", "mockup", "upload"] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const PRODUCT_SOURCE_LABELS: Readonly<Record<ProductSource, string>> = {
  design: "A design version",
  mockup: "A mockup board",
  upload: "A photograph of your own",
};

export interface ChosenProduct {
  readonly source: ProductSource;
  /** The board on the canvas, or the file that was uploaded. */
  readonly id: string;
  readonly name: string;
}

export interface CampaignForm {
  readonly product: ChosenProduct | null;
  /** Step 2's toggle. Off means the layout's own styles and colours are used. */
  readonly applyBrand: boolean;
  readonly brandId: string | null;
  /** Step 3, optional: the logo or crest to place. */
  readonly logoFileId: string | null;
  readonly highlight: string;
  readonly campaign: Campaign | null;
  readonly style: CampaignStyle | null;
  readonly destination: Destination | null;
  readonly imageCount: number;
}

export const EMPTY_FORM: CampaignForm = {
  product: null,
  applyBrand: true,
  brandId: null,
  logoFileId: null,
  highlight: "",
  campaign: null,
  style: null,
  destination: null,
  imageCount: 1,
};

/** What one step still needs, in the words the form shows beside it. */
export interface StepState {
  readonly id: CampaignStep;
  readonly number: number;
  readonly label: string;
  readonly lead: string;
  readonly required: boolean;
  readonly done: boolean;
  /** What is missing, or null when the step is done or optional and left out. */
  readonly needs: string | null;
  readonly ruleId: string;
}

const needsOf = (form: CampaignForm, step: CampaignStep): string | null => {
  switch (step) {
    case "product":
      return form.product === null ? "Pick the design version, the mockup or the photograph this is about." : null;
    case "brand":
      return form.applyBrand && form.brandId === null ? "Choose which brand to apply, or turn the toggle off." : null;
    case "logo":
      return null;
    case "highlight":
      return form.highlight.trim() === "" ? "Say what you want to highlight, in your own words." : null;
    case "campaign":
      return form.campaign === null ? "Choose what this is for." : null;
    case "style":
      return form.style === null ? "Choose how it should look." : null;
    case "destination":
      return form.destination === null ? "Choose the size it is made at." : null;
  }
};

/** Whether a step counts as finished, which is what the numbered list on the left shows. */
const doneOf = (form: CampaignForm, step: CampaignStep): boolean => {
  if (step === "logo") return form.logoFileId !== null;
  return needsOf(form, step) === null;
};

/** Every step, with what it still needs. The form draws itself from this and decides nothing. */
export const stepStates = (form: CampaignForm): readonly StepState[] =>
  STEPS.map((step) => ({ ...step, done: doneOf(form, step.id), needs: needsOf(form, step.id) }));

/** The first step that is not finished, which is the one the form opens on. */
export const firstUnfinished = (form: CampaignForm): CampaignStep | null =>
  CAMPAIGN_STEPS.find((step) => needsOf(form, step) !== null) ?? null;

/** A form with every required step answered, which is the only thing that can be generated from. */
export interface ReadyForm extends CampaignForm {
  readonly product: ChosenProduct;
  readonly campaign: Campaign;
  readonly style: CampaignStyle;
  readonly destination: Destination;
}

export type FormVerdict =
  | Readonly<{ ok: true; form: ReadyForm }>
  | Readonly<{ ok: false; step: CampaignStep; reason: string; ruleId: string }>;

/**
 * Whether the footer's Generate may be pressed, and when it may not, which step to go to and why.
 * Nothing is generated from a half-filled form, and the form says which step rather than greying a
 * button out with no reason.
 */
export function formVerdict(form: CampaignForm): FormVerdict {
  const unfinished = firstUnfinished(form);
  if (unfinished) return { ok: false, step: unfinished, reason: needsOf(form, unfinished)!, ruleId: MARKETING_RULE };
  if (form.highlight.length > HIGHLIGHT_LIMIT) {
    return { ok: false, step: "highlight", reason: `Keep that to ${HIGHLIGHT_LIMIT} characters.`, ruleId: MARKETING_RULE };
  }
  if (!Number.isInteger(form.imageCount) || form.imageCount < 1 || form.imageCount > MAX_IMAGE_COUNT) {
    return { ok: false, step: "destination", reason: `Ask for between 1 and ${MAX_IMAGE_COUNT} images.`, ruleId: MARKETING_RULE };
  }
  return { ok: true, form: form as ReadyForm };
}

/** How far through the form a person is, for the progress line the spec's left column shows. */
export const stepsDone = (form: CampaignForm): number => stepStates(form).filter((step) => step.done).length;
