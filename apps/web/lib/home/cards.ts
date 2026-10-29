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
    target: page("/catalogue"),
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
 * The ways in the create-new modal. "Base products" does not call a base factory-approved: every
 * seeded article is a Knitwright draft until a factory reviews it (plan v5 X1, decision 0066).
 */
export const CREATE_WAYS: readonly HomeCard[] = [
  {
    id: "base-products",
    title: "Base products",
    text: "Start from a Knitwright base article. Each one is a draft until a factory reviews it.",
    target: page("/catalogue"),
    feature: "F-S4",
  },
  {
    id: "templates",
    title: "Templates",
    text: "Ready-made sportswear designs to remix.",
    target: page("/catalogue?tab=templates"),
    feature: "F-S4",
  },
  {
    id: "crest",
    title: "From your crest or logo",
    text: "Your club's colours, crest and sponsors, put on a design in one press.",
    target: page("/club"),
    feature: "F-T2",
  },
  {
    id: "team",
    title: "Your team",
    text: "Designs other people in your workspace have shared with you.",
    target: later,
    feature: "F-S4",
  },
];

/** The groups the modal draws, so the heading of each group lives with its ways. */
export const CREATE_GROUPS: readonly Readonly<{ label: string; wayIds: readonly string[] }>[] = [
  { label: "Knitwright library", wayIds: ["base-products", "templates"] },
  { label: "Your own", wayIds: ["crest", "team"] },
];

/** The ways of one group, in the group's order. */
export const waysOf = (group: Readonly<{ wayIds: readonly string[] }>): readonly HomeCard[] =>
  group.wayIds.flatMap((id) => CREATE_WAYS.filter((way) => way.id === id));
