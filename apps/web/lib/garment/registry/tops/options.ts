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
    label: "Neckline",
    help: "The shape of the opening for the head.",
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
      { id: "none", label: "No collar", help: "The neck is finished with a plain band." },
      { id: "polo-collar", label: "Polo collar", help: "A collar that folds over and opens at the front." },
      { id: "band-collar", label: "Band collar", help: "A collar that stands up all the way round the neck." },
    ],
    defaultChoice: "none",
  },
  {
    id: "placket",
    label: "Placket",
    help: "The strip of fabric that fastens the neck opening.",
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
    label: "Hem shape",
    choices: [
      { id: "straight", label: "Straight across" },
      { id: "curved", label: "Curved", help: "The hem curves, and is longer at the back." },
      { id: "side-vent", label: "Side vents", help: "A straight hem with a small split at each side." },
    ],
    defaultChoice: "straight",
  },
  {
    id: "side-panels",
    label: "Side panels",
    choices: [
      { id: "none", label: "No side panels" },
      { id: "contrast-insert", label: "Contrast strips", help: "A strip of a different colour runs down each side." },
    ],
    defaultChoice: "none",
  },
  {
    id: "cuffs",
    label: "Cuffs",
    choices: [
      { id: "none", label: "No cuffs", help: "The sleeves are simply hemmed." },
      { id: "rib-cuff", label: "Ribbed cuffs", help: "Stretchy ribbed bands at the end of the sleeves." },
    ],
    defaultChoice: "none",
  },
];
