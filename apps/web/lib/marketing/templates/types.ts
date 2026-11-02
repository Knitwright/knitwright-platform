import { MARKETING_RULE } from "../rules";

/**
 * WHAT A MARKETING TEMPLATE IS (spec `docs/spec/07-template-library.md`, "Marketing templates";
 * plan v5 L4, decision 0094).
 *
 * `07` says a marketing template has "slots for mockups, brand kit (logo, colours, fonts) and
 * text", a set of formats, and "text fields with a character limit and an optional 'write this for
 * me'". This file is that sentence as types, and nothing more: the layouts themselves are rows
 * (`templates` of kind `marketing`), built in `plans.ts` and `build.ts`.
 *
 * Two decisions here are load-bearing:
 *
 *   * **A slot is a fraction of the artboard, never a pixel.** One layout therefore fits every
 *     format `07` gives it without a second set of numbers, and `layout.ts` turns fractions into
 *     pixels for one size. A template that carried pixels would be a template per size.
 *   * **A slot names a colour role, never a colour.** `07`'s rule for every template is that it
 *     "uses colour roles, never fixed colours, so the user's brand kit applies with one click", and
 *     Replace keeps the colours because the colours were never in the content.
 */

/** What goes in a slot. A mockup slot holds a picture the platform drew and nothing else. */
export const SLOT_KINDS = ["mockup", "logo", "text", "qr", "shape"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

/** The brand's own type styles (spec F-L2: "Text uses the brand's Headline / Subheadline / Body styles"). */
export const TEXT_STYLES = ["headline", "subheadline", "body"] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

/** The colour roles a brand kit fills, as `07` names them for a design template. */
export const COLOUR_ROLES = ["primary", "secondary", "accent", "trim", "background"] as const;
export type ColourRole = (typeof COLOUR_ROLES)[number];

/** Where a slot sits, as fractions of the artboard's width and height, so one layout fits every size. */
export interface SlotRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MarketingSlot {
  readonly id: string;
  readonly kind: SlotKind;
  /** What the panel calls this slot. Never a sentence; the panel writes those. */
  readonly label: string;
  readonly rect: SlotRect;
  /** Which colour of the brand kit fills it. A slot never carries a colour of its own. */
  readonly colourRole: ColourRole;
  /** The brand type style a text slot is set in, or null for a slot that holds no words. */
  readonly style: TextStyle | null;
  /** The most characters a text slot takes (`07`), or null. Knitwright's own figure; see MARKETING_GAPS. */
  readonly limit: number | null;
  /** The words shown while the slot is empty. A label, never content pretending to be written. */
  readonly placeholder: string | null;
  /**
   * True when nothing may redraw what is in the slot: a mockup slot holds the picture the platform
   * drew, and the garment in it is never restyled, recoloured or redrawn (spec decision 13).
   */
  readonly pixelLocked: boolean;
  readonly ruleId: string;
}

/** The six groups of `07`'s marketing table, in its order. */
export const MARKETING_GROUPS = ["kit-launch", "club-life", "team-store", "brand-drop", "e-commerce", "print"] as const;
export type MarketingGroup = (typeof MARKETING_GROUPS)[number];

export const GROUP_LABELS: Readonly<Record<MarketingGroup, string>> = {
  "kit-launch": "Kit launch",
  "club-life": "Club life",
  "team-store": "Team store",
  "brand-drop": "Brand drop",
  "e-commerce": "E-commerce",
  print: "Print",
};

/**
 * The formats `07` gives a marketing template, as the keys of `launch_artboard_presets` (L1,
 * decision 0091). The sizes are rows, never numbers here: a panel reads them from
 * `LaunchContext.presets`, and `07`'s "story/reel 9:16" and "TikTok 9:16" are one size.
 */
export const MARKETING_FORMATS = ["social-square-1-1", "social-post-4-5", "story-9-16", "hero-banner-16-9", "a4-print"] as const;
export type MarketingFormat = (typeof MARKETING_FORMATS)[number];

export const FORMAT_LABELS: Readonly<Record<MarketingFormat, string>> = {
  "social-square-1-1": "Social square 1:1",
  "social-post-4-5": "Social post 4:5",
  "story-9-16": "Story 9:16",
  "hero-banner-16-9": "Hero banner 16:9",
  "a4-print": "A4 print",
};

/** One layout of `07`'s table, before it becomes one row per format. */
export interface MarketingLayout {
  /** Lower-case, dashed: the first part of each row's slug. */
  readonly key: string;
  readonly title: string;
  readonly group: MarketingGroup;
  /** One line for the card. Says what the layout is for, and promises nothing. */
  readonly lead: string;
  readonly formats: readonly MarketingFormat[];
  readonly slots: readonly MarketingSlot[];
}

/** One `templates` row of kind `marketing`: a layout at one format. */
export interface MarketingTemplate {
  readonly slug: string;
  readonly title: string;
  readonly group: MarketingGroup;
  readonly lead: string;
  readonly format: MarketingFormat;
  readonly layoutKey: string;
  readonly slots: readonly MarketingSlot[];
  readonly ruleId: string;
  /** Says where this layout came from. Every seeded row says nobody has reviewed it. */
  readonly label: string;
}

/** What every seeded row says about itself. Nothing in the library is reviewed by anyone yet. */
export const SEED_LABEL = "Knitwright starter layout, not reviewed by anyone";

/** A slot, with the parts every slot shares filled in. */
export function slot(
  input: Readonly<{
    id: string;
    kind: SlotKind;
    label: string;
    rect: SlotRect;
    colourRole?: ColourRole;
    style?: TextStyle;
    limit?: number;
    placeholder?: string;
  }>,
): MarketingSlot {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    rect: input.rect,
    colourRole: input.colourRole ?? (input.kind === "text" ? "primary" : "background"),
    style: input.style ?? null,
    limit: input.limit ?? null,
    placeholder: input.placeholder ?? null,
    // A mockup is the picture the platform drew. Nothing else in a layout is pixel-locked.
    pixelLocked: input.kind === "mockup",
    ruleId: MARKETING_RULE,
  };
}

export const isMarketingFormat = (value: string): value is MarketingFormat =>
  (MARKETING_FORMATS as readonly string[]).includes(value);

export const isMarketingGroup = (value: string): value is MarketingGroup =>
  (MARKETING_GROUPS as readonly string[]).includes(value);
