import type { OptionDefinition } from "../../definitions";

/** The questions a designer answers about a top. */
export const TOPS_OPTIONS: readonly OptionDefinition[] = [
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
    id: "neckline",
    label: "Neckline shape",
    choices: [
      { id: "crew", label: "Round neck" },
      { id: "v-neck", label: "V neck" },
    ],
    defaultChoice: "crew",
  },
  {
    id: "collar",
    label: "Collar",
    choices: [
      { id: "none", label: "No collar, just a neckband" },
      { id: "polo-collar", label: "Polo collar that folds over" },
      { id: "band-collar", label: "Band collar that stands up" },
    ],
    defaultChoice: "none",
  },
  {
    id: "placket",
    label: "Placket (the strip that fastens the neck opening)",
    choices: [
      { id: "none", label: "No placket" },
      { id: "buttons", label: "Buttons" },
      { id: "zip", label: "Zip" },
    ],
    defaultChoice: "none",
  },
  {
    id: "sleeve-type",
    label: "Sleeve type",
    choices: [
      { id: "set-in", label: "Set in, with a seam at the shoulder" },
      { id: "raglan", label: "Raglan, with a seam running up to the neck" },
    ],
    defaultChoice: "set-in",
  },
  {
    id: "sleeve-length",
    label: "Sleeve length",
    choices: [
      { id: "short", label: "Short sleeve" },
      { id: "long", label: "Long sleeve" },
    ],
    defaultChoice: "short",
  },
  {
    id: "hem-shape",
    label: "Bottom hem shape",
    choices: [
      { id: "straight", label: "Straight across" },
      { id: "curved", label: "Curved, longer at the back" },
      { id: "side-vent", label: "Straight with a small split at each side" },
    ],
    defaultChoice: "straight",
  },
  {
    id: "side-panels",
    label: "Side panels",
    choices: [
      { id: "none", label: "No side panels" },
      { id: "contrast-insert", label: "A strip of a different colour down each side" },
    ],
    defaultChoice: "none",
  },
  {
    id: "cuffs",
    label: "Sleeve cuffs",
    choices: [
      { id: "none", label: "No cuffs, plain hemmed sleeves" },
      { id: "rib-cuff", label: "Stretchy ribbed cuffs" },
    ],
    defaultChoice: "none",
  },
];
