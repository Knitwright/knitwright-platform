import type { GarmentType } from "../../definitions";

const ALL_WEARERS = ["men", "women", "youth"] as const;

const POINTS = [
  "waist-relaxed",
  "waist-stretched",
  "waistband-height",
  "hip",
  "front-rise",
  "back-rise",
  "thigh",
  "knee",
  "leg-opening",
  "inseam",
  "outseam",
] as const;

const PANELS = ["legs-front", "legs-back", "waistband", "gusset", "side-stripes", "cuffs"] as const;

const COMMON = { family: "bottoms", wearers: ALL_WEARERS, pointsOfMeasure: POINTS, panels: PANELS } as const;

const FIT = { option: "fit" } as const;
const FULL = { option: "leg-length", choices: ["full"] } as const;
const DRAWCORD_OR_ELASTIC = { option: "waistband", choices: ["elastic-drawcord", "elastic"] } as const;
const GUSSET = { option: "gusset" } as const;
const STRIPE = { option: "side-stripe" } as const;
const POCKETS = { option: "pockets" } as const;

export const BOTTOMS_TYPES: readonly GarmentType[] = [
  {
    ...COMMON,
    id: "shorts",
    label: "Shorts",
    options: [
      FIT,
      { option: "leg-length", choices: ["short"], default: "short" },
      DRAWCORD_OR_ELASTIC,
      { option: "leg-finish", choices: ["hem"] },
      GUSSET,
      STRIPE,
      POCKETS,
    ],
  },
  {
    ...COMMON,
    id: "joggers",
    label: "Joggers",
    options: [FIT, FULL, DRAWCORD_OR_ELASTIC, { option: "leg-finish", choices: ["rib-cuff"], default: "rib-cuff" }, GUSSET, STRIPE, POCKETS],
  },
  {
    ...COMMON,
    id: "leggings",
    label: "Leggings",
    options: [
      { option: "leg-length", choices: ["full", "cropped"] },
      { option: "waistband", choices: ["wide-band", "elastic"], default: "wide-band" },
      { option: "leg-finish", choices: ["hem"] },
      { option: "gusset", default: "crotch-gusset" },
      STRIPE,
    ],
  },
  {
    ...COMMON,
    id: "track-pants",
    label: "Track pants",
    options: [FIT, FULL, DRAWCORD_OR_ELASTIC, { option: "leg-finish", choices: ["hem", "ankle-zip"] }, GUSSET, STRIPE, POCKETS],
  },
];
