import { later, newDesign, page, type Target } from "@/lib/home/targets";

/**
 * The dashed start cards of Recent (08 v3.6 "Projects home", d02). The first opens the create-new
 * modal; a card whose page is not built yet says so instead of linking nowhere (decision 0074).
 */

export interface StartCard {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly target: Target;
}

export const START_CARDS: readonly StartCard[] = [
  { id: "new-design", title: "Start a new design", text: "Begin from a Knitwright base, a template or your crest.", target: newDesign },
  { id: "browse", title: "Browse products and templates", text: "Start from a Knitwright base or a ready-made kit.", target: page("/products") },
  { id: "mood-board", title: "Mood board", text: "Collect kit ideas before and while you design.", target: later },
  { id: "range-plan", title: "Range plan", text: "Plan a season's collection with its costs and margins.", target: page("/studio/collections") },
  { id: "repeat-print", title: "Repeat print", text: "Make a seamless pattern for stripes, camo or fades.", target: later },
];
