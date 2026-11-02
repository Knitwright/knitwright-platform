import { centre, slot, type ScenePlan } from "./build";

/**
 * `07`'s Retail group and F-L1's E-commerce list, which are the same shelf read twice:
 *
 *   `07`:   Shop rail · e-commerce white background (square and 4:5) · lifestyle model studio
 *           colour backdrop
 *   F-L1:   White background 1:1 and 4:5 · Studio colour backdrop · Size-chart card ·
 *           Colour-chart card
 *
 * The union is seven scenes. The white backgrounds, the studio colour backdrop and the two chart
 * cards are drawn by this workstream; the shop rail and the studio backdrop **with a model in it**
 * are photographic places, so they are AI scenes L3 runs.
 *
 * The two chart cards hold no garment: the card is the picture, and the figures on it come from the
 * design's own charts. `charts.ts` draws them, and it states every gap rather than filling a number
 * in.
 */

const ALL_SPORTS = ["football", "cricket", "training", "esports", "running-gym", "combat"];

export const RETAIL_SCENES: readonly ScenePlan[] = [
  {
    slug: "ecommerce-white-square",
    title: "E-commerce white, square",
    group: "retail",
    source: "deterministic",
    backdrop: "white",
    lighting: "Even studio light, no shadow",
    people: "none",
    slots: [slot("front", "ghost", "Filled out, nobody in it", "Eye level, straight on", centre(0.72, 0.8))],
    sports: ALL_SPORTS,
    moods: ["clean"],
    crops: ["1:1"],
  },
  {
    slug: "ecommerce-white-four-five",
    title: "E-commerce white, 4:5",
    group: "retail",
    source: "deterministic",
    backdrop: "white",
    lighting: "Even studio light, no shadow",
    people: "none",
    slots: [slot("front", "ghost", "Filled out, nobody in it", "Eye level, straight on", centre(0.74, 0.82))],
    sports: ALL_SPORTS,
    moods: ["clean"],
    crops: ["4:5"],
  },
  {
    slug: "studio-colour-backdrop",
    title: "Studio colour backdrop",
    group: "retail",
    source: "deterministic",
    backdrop: "studio",
    lighting: "Two soft boxes, seamless paper behind",
    people: "none",
    slots: [slot("three-quarter", "hanging", "Hung from the shoulders", "Eye level, turned 45°", centre(0.58, 0.8))],
    sports: ALL_SPORTS,
    moods: ["clean", "understated"],
  },
  {
    slug: "size-chart-card",
    title: "Size-chart card",
    group: "retail",
    source: "deterministic",
    backdrop: "white",
    lighting: "Flat, as a card is printed",
    people: "none",
    slots: [slot("front", "chart", "No garment: the card is the picture", "Straight on", centre(0.88, 0.88))],
    sports: ALL_SPORTS,
    moods: ["clean"],
    card: "size-chart",
  },
  {
    slug: "colour-chart-card",
    title: "Colour-chart card",
    group: "retail",
    source: "deterministic",
    backdrop: "white",
    lighting: "Flat, as a card is printed",
    people: "none",
    slots: [slot("front", "chart", "No garment: the card is the picture", "Straight on", centre(0.88, 0.88))],
    sports: ALL_SPORTS,
    moods: ["clean"],
    card: "colour-chart",
  },
  {
    slug: "shop-rail",
    title: "Shop rail",
    group: "retail",
    source: "ai",
    backdrop: "interior",
    lighting: "Shop spots from the ceiling",
    people: "none",
    slots: [slot("three-quarter", "hanging", "Hung on the rail", "Eye level, from the side", centre(0.44, 0.66))],
    sports: ALL_SPORTS,
    moods: ["clean"],
  },
  {
    slug: "lifestyle-model-studio-backdrop",
    title: "Lifestyle model on a studio backdrop",
    group: "retail",
    source: "ai",
    backdrop: "studio",
    lighting: "Two soft boxes, seamless paper behind",
    people: "one",
    slots: [slot("front", "worn", "Hero front", "Eye level, straight on", centre(0.46, 0.76))],
    sports: ALL_SPORTS,
    moods: ["clean", "sharp"],
  },
];
