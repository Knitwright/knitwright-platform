import type { GarmentType } from "../../definitions";

const ALL_WEARERS = ["men", "women", "youth"] as const;

/** Points of measure every top has. The three conditional ones are listed too. */
const POINTS = [
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
  "collar-height",
  "placket-length",
  "placket-width",
] as const;

const PANELS = [
  "body-front",
  "body-back",
  "sleeve-left",
  "sleeve-right",
  "neckband",
  "collar",
  "placket",
  "side-panels",
  "cuffs",
] as const;

const COMMON = {
  family: "tops",
  wearers: ALL_WEARERS,
  pointsOfMeasure: POINTS,
  panels: PANELS,
} as const;

const FIT = { option: "fit" } as const;
const SET_IN = { option: "sleeve-type", choices: ["set-in"] } as const;
const NO_COLLAR = { option: "collar", choices: ["none"] } as const;
const STRAIGHT_OR_CURVED = { option: "hem-shape", choices: ["straight", "curved"] } as const;
const NO_SIDE_PANELS = { option: "side-panels", choices: ["none"] } as const;

export const TOPS_TYPES: readonly GarmentType[] = [
  {
    ...COMMON,
    id: "crew-tee",
    label: "Crew neck tee",
    options: [
      FIT,
      { option: "neckline", choices: ["crew"] },
      NO_COLLAR,
      SET_IN,
      { option: "sleeve-length", choices: ["short"] },
      STRAIGHT_OR_CURVED,
      NO_SIDE_PANELS,
    ],
  },
  {
    ...COMMON,
    id: "v-neck-tee",
    label: "V neck tee",
    options: [
      FIT,
      { option: "neckline", choices: ["v-neck"] },
      NO_COLLAR,
      SET_IN,
      { option: "sleeve-length", choices: ["short"] },
      STRAIGHT_OR_CURVED,
      NO_SIDE_PANELS,
    ],
  },
  {
    ...COMMON,
    id: "long-sleeve-tee",
    label: "Long sleeve tee",
    options: [
      FIT,
      { option: "neckline", choices: ["crew"] },
      NO_COLLAR,
      SET_IN,
      { option: "sleeve-length", choices: ["long"] },
      STRAIGHT_OR_CURVED,
      NO_SIDE_PANELS,
      { option: "cuffs" },
    ],
  },
  {
    ...COMMON,
    id: "polo",
    label: "Polo shirt",
    options: [
      FIT,
      { option: "neckline", choices: ["crew"] },
      { option: "collar", choices: ["polo-collar"], default: "polo-collar" },
      { option: "placket", default: "buttons" },
      SET_IN,
      { option: "sleeve-length" },
      { option: "hem-shape" },
      NO_SIDE_PANELS,
      { option: "cuffs" },
    ],
  },
  {
    ...COMMON,
    id: "team-jersey",
    label: "Team jersey",
    options: [
      FIT,
      { option: "neckline" },
      { option: "collar", choices: ["none", "band-collar"] },
      { option: "placket" },
      { option: "sleeve-type" },
      { option: "sleeve-length" },
      { option: "hem-shape" },
      { option: "side-panels" },
      { option: "cuffs" },
    ],
  },
];
