import type { GarmentType } from "../../definitions";

const ALL_WEARERS = ["men", "women", "youth"] as const;

const BODY_AND_NECK = ["chest-width", "body-length", "neck-width", "front-neck-drop", "back-neck-drop"] as const;
const STRAP_POINTS = ["armhole-depth", "strap-width", "back-width-narrowest"] as const;
const SLEEVE_POINTS = ["shoulder-width", "sleeve-length", "armhole", "upper-arm", "sleeve-opening"] as const;

const SLEEVELESS = { option: "sleeves", choices: ["sleeveless"] } as const;
const SEAMS = { option: "seam-type" } as const;
const FLAT_SEAMS = { option: "seam-type", default: "flatlock" } as const;

export const CLOSE_FITTING_TYPES: readonly GarmentType[] = [
  {
    id: "singlet",
    family: "close-fitting",
    label: "Singlet",
    wearers: ALL_WEARERS,
    pointsOfMeasure: [...BODY_AND_NECK, "hem-width", ...STRAP_POINTS],
    panels: ["body-front", "body-back", "binding"],
    options: [{ option: "fit" }, SLEEVELESS, { option: "back-style" }, { option: "edge-finish", choices: ["bound", "turned"] }, SEAMS],
  },
  {
    id: "vest",
    family: "close-fitting",
    label: "Vest",
    wearers: ALL_WEARERS,
    pointsOfMeasure: [...BODY_AND_NECK, "hem-width", ...STRAP_POINTS],
    panels: ["body-front", "body-back", "binding"],
    options: [
      { option: "fit" },
      SLEEVELESS,
      { option: "back-style", choices: ["straight"] },
      { option: "edge-finish", choices: ["bound", "turned"], default: "turned" },
      SEAMS,
    ],
  },
  {
    id: "sports-bra",
    family: "close-fitting",
    label: "Sports bra",
    wearers: ["women", "youth"],
    sizeSystems: { women: "sports-bra", youth: "sports-bra" },
    pointsOfMeasure: [...BODY_AND_NECK, "underbust", ...STRAP_POINTS],
    panels: ["body-front", "body-back", "binding", "underband"],
    options: [
      SLEEVELESS,
      { option: "back-style", default: "racerback" },
      { option: "edge-finish", choices: ["elastic", "bound"], default: "elastic" },
      { option: "underband" },
      FLAT_SEAMS,
    ],
  },
  {
    id: "compression-top",
    family: "close-fitting",
    label: "Compression top",
    wearers: ALL_WEARERS,
    pointsOfMeasure: [...BODY_AND_NECK, "hem-width", ...SLEEVE_POINTS],
    panels: ["body-front", "body-back", "sleeve-left", "sleeve-right", "binding"],
    options: [
      { option: "sleeves", choices: ["short", "long"], default: "long" },
      { option: "edge-finish", choices: ["bound", "turned"] },
      FLAT_SEAMS,
    ],
  },
];
