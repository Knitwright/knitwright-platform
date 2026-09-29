import type { GarmentType } from "../../definitions";

const ALL_WEARERS = ["men", "women", "youth"] as const;

const BODY_POINTS = [
  "chest-width",
  "body-length",
  "shoulder-width",
  "sleeve-length",
  "armhole",
  "upper-arm",
  "sleeve-opening",
  "hem-width",
  "neck-width",
  "front-neck-drop",
  "back-neck-drop",
] as const;
const RIB_AND_POCKET_POINTS = ["pocket-opening", "pocket-width", "pocket-height", "cuff-height", "hem-band-height"] as const;

const BODY_PANELS = ["body-front", "body-back", "sleeve-left", "sleeve-right"] as const;
const HOOD_PANELS = ["hood", "hood-lining"] as const;
const RIB_PANELS = ["cuffs", "hem-band"] as const;

const FIT = { option: "fit" } as const;
const SLEEVE = { option: "sleeve-type" } as const;
const HOOD = { option: "hood" } as const;
const CORD = { option: "hood-drawcord" } as const;
const FULL_ZIP = { option: "front-opening", choices: ["full-zip"], default: "full-zip" } as const;
const CUFFS = { option: "cuffs" } as const;
const HEM = { option: "hem-finish" } as const;

const COMMON = { family: "outerwear", wearers: ALL_WEARERS } as const;

export const OUTERWEAR_TYPES: readonly GarmentType[] = [
  {
    ...COMMON,
    id: "pullover-hoodie",
    label: "Pullover hoodie",
    pointsOfMeasure: [...BODY_POINTS, "hood-height", "hood-width", ...RIB_AND_POCKET_POINTS],
    panels: [...BODY_PANELS, ...HOOD_PANELS, "kangaroo-pocket", ...RIB_PANELS],
    options: [
      FIT,
      SLEEVE,
      HOOD,
      CORD,
      { option: "front-opening", choices: ["none"] },
      { option: "pockets", choices: ["kangaroo", "side-seam", "none"], default: "kangaroo" },
      CUFFS,
      HEM,
    ],
  },
  {
    ...COMMON,
    id: "zip-hoodie",
    label: "Zip hoodie",
    pointsOfMeasure: [...BODY_POINTS, "hood-height", "hood-width", "zip-length", ...RIB_AND_POCKET_POINTS],
    panels: [...BODY_PANELS, ...HOOD_PANELS, ...RIB_PANELS],
    options: [FIT, SLEEVE, HOOD, CORD, FULL_ZIP, { option: "pockets", choices: ["side-seam", "zip-side", "none"] }, CUFFS, HEM],
  },
  {
    ...COMMON,
    id: "track-jacket",
    label: "Track jacket",
    pointsOfMeasure: [...BODY_POINTS, "zip-length", ...RIB_AND_POCKET_POINTS, "collar-height"],
    panels: [...BODY_PANELS, "collar", "neckband", ...RIB_PANELS],
    options: [
      FIT,
      SLEEVE,
      FULL_ZIP,
      { option: "collar" },
      { option: "pockets", choices: ["zip-side", "side-seam", "none"], default: "zip-side" },
      CUFFS,
      HEM,
    ],
  },
];
