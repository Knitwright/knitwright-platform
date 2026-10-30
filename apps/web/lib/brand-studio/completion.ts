/**
 * The completion % of F-S9: the pill in the top bar and the number on the Overview tab.
 *
 * It counts only what the brand has actually said. A step is done when a value is there, never
 * because something was guessed for it. The weights are Knitwright's own idea of how much each part
 * matters and are labelled as such; they are not a measurement and no factory supplied them.
 */

import type { BrandRecord } from "./types";
import { ASSET_KINDS, FONT_ROLES, STYLE_FIELDS, type AssetKind } from "./words";

/** Where the weights come from. Shown wherever the % is explained. */
export const WEIGHT_SOURCE = "Knitwright's own weighting, not reviewed by anyone";

export interface CompletionStep {
  readonly key: string;
  readonly label: string;
  /** What is missing, said plainly. Shown when the step is not done. */
  readonly asks: string;
  readonly weight: number;
  readonly done: boolean;
  /** The count the Overview card shows, when the step counts things. */
  readonly count: number | null;
}

export interface Completion {
  /** 0 to 100, whole numbers. */
  readonly percent: number;
  readonly steps: readonly CompletionStep[];
}

const assetsOfKind = (record: BrandRecord, kind: AssetKind): number =>
  record.assets.filter((asset) => asset.kind === kind).length;

const colourCount = (record: BrandRecord): number =>
  record.palettes.reduce((sum, palette) => sum + palette.colours.length, 0);

const fontCount = (record: BrandRecord): number =>
  FONT_ROLES.filter((role) => record.fonts.some((font) => font.role === role && font.fontKey !== null)).length;

const styleCount = (record: BrandRecord): number =>
  STYLE_FIELDS.filter((field) => record.profile.style[field].trim() !== "").length;

type Plan = Readonly<{ key: string; label: string; asks: string; weight: number; of: (record: BrandRecord) => Readonly<{ done: boolean; count: number | null }> }>;

/** The steps, in the order the Overview shows them. */
const PLAN: readonly Plan[] = [
  {
    key: "details",
    label: "Details",
    asks: "Your category and a line about the brand.",
    weight: 2,
    of: (record) => ({ done: record.profile.about.trim() !== "", count: null }),
  },
  {
    key: "logos",
    label: "Logos",
    asks: "At least one logo, from your uploads.",
    weight: 3,
    of: (record) => ({ done: assetsOfKind(record, "logo") > 0, count: assetsOfKind(record, "logo") }),
  },
  {
    key: "colours",
    label: "Colours",
    asks: "A palette with at least one colour.",
    weight: 3,
    of: (record) => ({ done: colourCount(record) > 0, count: record.palettes.length }),
  },
  {
    key: "fonts",
    label: "Fonts",
    asks: "A font for each of the five roles.",
    weight: 3,
    of: (record) => ({ done: fontCount(record) === FONT_ROLES.length, count: fontCount(record) }),
  },
  {
    key: "graphics",
    label: "Graphics",
    asks: "At least one graphic, from your uploads.",
    weight: 1,
    of: (record) => ({ done: assetsOfKind(record, "graphic") > 0, count: assetsOfKind(record, "graphic") }),
  },
  {
    key: "style",
    label: "Visual style",
    asks: "Setting, Art direction and Rules & boundaries.",
    weight: 2,
    of: (record) => ({ done: styleCount(record) === STYLE_FIELDS.length, count: styleCount(record) }),
  },
  {
    key: "sportswear",
    label: "Sportswear",
    asks: "A crest, and the sizes you make by default.",
    weight: 2,
    of: (record) => ({
      done: assetsOfKind(record, "crest") > 0 && record.profile.defaultSizeRange.length > 0,
      count: ASSET_KINDS.filter((kind) => kind !== "logo" && kind !== "graphic").reduce((sum, kind) => sum + assetsOfKind(record, kind), 0),
    }),
  },
];

/** The steps of the % and how far each one is, so a screen can show both the number and what is left. */
export function completionOf(record: BrandRecord): Completion {
  const steps = PLAN.map((plan) => ({ key: plan.key, label: plan.label, asks: plan.asks, weight: plan.weight, ...plan.of(record) }));
  const total = steps.reduce((sum, step) => sum + step.weight, 0);
  const have = steps.reduce((sum, step) => sum + (step.done ? step.weight : 0), 0);
  return { percent: Math.round((have / total) * 100), steps };
}

/** The steps still to do, for the Overview list. */
export const stillToDo = (completion: Completion): readonly CompletionStep[] => completion.steps.filter((step) => !step.done);
