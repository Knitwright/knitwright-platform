import type { OptionDefinition, Rule } from "../../definitions";

/** The questions a designer answers about a hoodie or a track jacket. */
export const OUTERWEAR_OPTIONS: readonly OptionDefinition[] = [
  {
    id: "fit",
    label: "Fit",
    choices: [
      { id: "regular", label: "Regular" },
      { id: "slim", label: "Slim" },
      { id: "relaxed", label: "Relaxed" },
    ],
    defaultChoice: "regular",
  },
  {
    id: "sleeve-type",
    label: "Sleeve type",
    choices: [
      { id: "set-in", label: "Set in", help: "The sleeve is sewn on at a seam across the shoulder." },
      {
        id: "raglan",
        label: "Raglan",
        help: "The sleeve runs up to the neck with a diagonal seam, and there is no shoulder seam.",
      },
    ],
    defaultChoice: "set-in",
  },
  {
    id: "hood",
    label: "Hood",
    choices: [
      { id: "single-layer", label: "Single layer", help: "One layer of fabric, with the edge of the opening hemmed." },
      { id: "lined", label: "Lined", help: "Two layers of fabric, sewn together round the opening." },
    ],
    defaultChoice: "lined",
  },
  {
    id: "hood-drawcord",
    label: "Hood drawcord",
    help: "A cord round the opening of the hood to pull it tighter.",
    choices: [
      { id: "none", label: "No drawcord" },
      { id: "drawcord", label: "Drawcord" },
    ],
    defaultChoice: "drawcord",
  },
  {
    id: "front-opening",
    label: "Front opening",
    choices: [
      { id: "none", label: "No opening", help: "The garment is pulled on over the head." },
      { id: "full-zip", label: "Full zip", help: "A zip runs all the way down the centre front." },
    ],
    defaultChoice: "none",
  },
  {
    id: "collar",
    label: "Collar",
    choices: [
      { id: "none", label: "No collar", help: "The neck is finished with a plain band." },
      { id: "stand-collar", label: "Stand collar", help: "A collar that stands up round the neck, with the zip running up into it." },
    ],
    defaultChoice: "stand-collar",
  },
  {
    id: "pockets",
    label: "Pockets",
    choices: [
      { id: "none", label: "No pockets" },
      { id: "kangaroo", label: "Kangaroo pocket", help: "One pocket across the front, open at both sides." },
      { id: "side-seam", label: "Side seam pockets", help: "Pockets hidden in the seam at each side." },
      { id: "zip-side", label: "Zipped side pockets" },
    ],
    defaultChoice: "side-seam",
  },
  {
    id: "cuffs",
    label: "Cuffs",
    choices: [
      { id: "rib-cuff", label: "Ribbed cuffs", help: "Stretchy ribbed bands at the end of the sleeves." },
      { id: "hem", label: "No cuffs", help: "The sleeves are simply hemmed." },
    ],
    defaultChoice: "rib-cuff",
  },
  {
    id: "hem-finish",
    label: "Hem",
    choices: [
      { id: "rib-band", label: "Ribbed band", help: "A stretchy ribbed band round the bottom edge." },
      { id: "hem", label: "Plain hem" },
    ],
    defaultChoice: "rib-band",
  },
];

/**
 * Combinations of choices that cannot be made. Only add a rule when the combination is
 * truly impossible, not when it is unusual.
 */
export const OUTERWEAR_RULES: readonly Rule[] = [
  {
    id: "kangaroo-needs-closed-front",
    when: [
      { option: "pockets", in: ["kangaroo"] },
      { option: "front-opening", in: ["full-zip"] },
    ],
    reason:
      "A kangaroo pocket is one piece across the front, so a zip down the middle would cut through it. Choose side pockets, or no front opening.",
  },
];
