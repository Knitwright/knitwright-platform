import { later, newDesign, page, type Target } from "./targets";

/**
 * The action cards on the studio home (spec F-S4, "Body") and the ways into a new design that the
 * create-new modal offers (spec F-S4, "Create a new design modal").
 *
 * There is no blank canvas and no "draft your own pattern": a custom pattern goes through the
 * pattern service request instead (spec F-S4; plan v5 Y1). A test holds that rule.
 */

export interface HomeCard {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly target: Target;
  /** The feature of docs/spec/02-features.md this card belongs to, for the PR trail. */
  readonly feature: string;
  /** A small tag beside the title ("Class B"), or nothing. */
  readonly tag?: string;
}

/** The six action cards, in the order the spec lists them. */
export const ACTION_CARDS: readonly HomeCard[] = [
  {
    id: "new-design",
    title: "Start a new design",
    text: "Begin from a Knitwright base, a sportswear template, or your crest.",
    target: newDesign,
    feature: "F-S4",
  },
  {
    id: "browse",
    title: "Browse bases and templates",
    text: "Every base article and template, with its fabrics, sizes and prices.",
    target: page("/products"),
    feature: "F-S8",
  },
  {
    id: "moodboard",
    title: "Moodboard",
    text: "Collect inspiration before and while you design.",
    target: later,
    feature: "F-S1",
  },
  {
    id: "collection",
    title: "Collection plan",
    text: "Plan a range: the styles, the colourways and the sizes.",
    target: later,
    feature: "F-S10",
  },
  {
    id: "pattern-fill",
    title: "Pattern fill",
    text: "Make a repeating tile — stripes, hoops, camo — to use on a design.",
    target: later,
    feature: "F-S4",
  },
  {
    id: "launch-pack",
    title: "Launch pack",
    text: "The photos, copy and posts for a kit launch.",
    target: later,
    feature: "F-L4",
  },
];

/**
 * The ways in the create-new modal (`08` v3.6, `09` screen 28, d20; decision 0150). "Products" does
 * not call a base factory-approved: every seeded article is a Knitwright draft until a factory
 * reviews it (plan v5 X1, decision 0066). Products opens the catalogue, where **Design this** opens
 * the product configurator, whose CREATE MY DESIGN opens Garment Studio.
 *
 * "Import your own pattern" is Class B and checked by the factory first. Its request is made from
 * inside a design today (`/studio/<id>/pattern-service`), so the way in from here says it is coming.
 * The shared-with-you way of v2.2 left the modal with the v3.6 layout; it had nothing behind it.
 */
export const CREATE_WAYS: readonly HomeCard[] = [
  {
    id: "products",
    title: "Products",
    text: "Browse the Knitwright bases.",
    target: page("/products"),
    feature: "F-S8",
  },
  {
    id: "templates",
    title: "Templates",
    text: "Ready-made kits to remix.",
    target: page("/templates"),
    feature: "F-S4",
  },
  {
    id: "crest",
    title: "Kit from your crest",
    text: "We build kits from your crest and colours.",
    // Crest to kit is the screen F-T2 asks for (plan v5 Z6, decision 0105).
    target: page("/ai-studio/workflow/crest-to-kit"),
    feature: "F-T2",
  },
  {
    id: "import-pattern",
    title: "Import your own pattern",
    text: "Class B · 50+ pieces · checked by the factory first.",
    target: later,
    feature: "F-S3",
    tag: "Class B",
  },
];

/** The groups the modal draws, so the heading of each group lives with its ways. */
export const CREATE_GROUPS: readonly Readonly<{ label: string; wayIds: readonly string[] }>[] = [
  { label: "Knitwright library", wayIds: ["products", "templates"] },
  { label: "Start your own", wayIds: ["crest", "import-pattern"] },
];

/** The ways of one group, in the group's order. */
export const waysOf = (group: Readonly<{ wayIds: readonly string[] }>): readonly HomeCard[] =>
  group.wayIds.flatMap((id) => CREATE_WAYS.filter((way) => way.id === id));
