import type { OptionDefinition, Rule } from "../../definitions";

/** The questions a designer answers about shorts, joggers, leggings and track pants. */
export const BOTTOMS_OPTIONS: readonly OptionDefinition[] = [
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
    id: "leg-length",
    label: "Leg length",
    choices: [
      { id: "short", label: "Short", help: "The leg ends above the knee." },
      { id: "cropped", label: "Cropped", help: "The leg ends between the knee and the ankle." },
      { id: "full", label: "Full length", help: "The leg reaches the ankle." },
    ],
    defaultChoice: "full",
  },
  {
    id: "waistband",
    label: "Waistband",
    choices: [
      { id: "elastic-drawcord", label: "Elastic with drawcord", help: "An elastic waistband with a cord to pull it tighter." },
      { id: "elastic", label: "Elastic, no drawcord" },
      { id: "wide-band", label: "Wide flat band", help: "A deep, smooth band with no drawcord, as on leggings." },
    ],
    defaultChoice: "elastic-drawcord",
  },
  {
    id: "leg-finish",
    label: "Leg opening",
    help: "How the bottom of each leg is finished.",
    choices: [
      { id: "hem", label: "Plain hem" },
      { id: "rib-cuff", label: "Ribbed cuffs", help: "Stretchy ribbed bands that hold the leg at the ankle." },
      { id: "ankle-zip", label: "Zip at the ankle", help: "A short zip at the bottom of each leg, so it opens over shoes." },
    ],
    defaultChoice: "hem",
  },
  {
    id: "gusset",
    label: "Gusset",
    help: "A piece sewn in where the legs meet, to give room to move.",
    choices: [
      { id: "none", label: "No gusset" },
      { id: "crotch-gusset", label: "Crotch gusset" },
    ],
    defaultChoice: "none",
  },
  {
    id: "side-stripe",
    label: "Side stripe",
    choices: [
      { id: "none", label: "No stripe" },
      { id: "contrast-stripe", label: "Contrast stripe", help: "A strip of a different colour runs down the outside of each leg." },
    ],
    defaultChoice: "none",
  },
  {
    id: "pockets",
    label: "Pockets",
    choices: [
      { id: "none", label: "No pockets" },
      { id: "side-seam", label: "Side seam pockets", help: "Pockets hidden in the seam at each hip." },
      { id: "zip-side", label: "Zipped side pockets" },
    ],
    defaultChoice: "side-seam",
  },
];

/**
 * Combinations of choices that cannot be made. Only add a rule when the combination is
 * truly impossible, not when it is unusual.
 */
export const BOTTOMS_RULES: readonly Rule[] = [
  {
    id: "ankle-zip-needs-long-leg",
    when: [
      { option: "leg-length", in: ["short"] },
      { option: "leg-finish", in: ["ankle-zip"] },
    ],
    reason: "A zip at the ankle needs a leg that reaches down to the ankle. Choose a longer leg, or a plain hem.",
  },
];
