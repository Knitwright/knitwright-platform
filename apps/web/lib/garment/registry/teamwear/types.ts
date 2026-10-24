import type { GarmentType } from "../../definitions";
import { BOTTOMS_PANELS } from "../bottoms/panels";
import { BOTTOMS_POINTS_OF_MEASURE } from "../bottoms/points-of-measure";
import { TOPS_PANELS } from "../tops/panels";
import { TOPS_POINTS_OF_MEASURE } from "../tops/points-of-measure";
import { CAP_PANELS, SOCK_PANELS } from "./panels";
import { CAP_POINTS_OF_MEASURE, SOCK_POINTS_OF_MEASURE } from "./points-of-measure";

/**
 * The articles. A shirt is a top and shorts and trousers are bottoms, so they share the points
 * of measure, panels and drawing of those families and add only what differs. Socks and caps
 * are new. The family is given where each list is used.
 */

const WEARERS = ["men", "women", "youth"] as const;
const ids = (items: readonly { readonly id: string }[]): readonly string[] => items.map((item) => item.id);

const TOP = { wearers: WEARERS, pointsOfMeasure: ids(TOPS_POINTS_OF_MEASURE), panels: ids(TOPS_PANELS) } as const;
// The cuffs panel is the tops one, drawn by the tops code, so it is not listed for legs.
const BOTTOM = {
  wearers: WEARERS,
  pointsOfMeasure: ids(BOTTOMS_POINTS_OF_MEASURE),
  panels: ids(BOTTOMS_PANELS).filter((id) => id !== "cuffs"),
} as const;

const FIT = { option: "fit" } as const;
const NO_SIDE_PANELS = { option: "side-panels", choices: ["none"] } as const;
const SHORTS_OPTIONS = [
  FIT,
  { option: "leg-length", choices: ["short"], default: "short" },
  { option: "waistband", choices: ["elastic-drawcord", "elastic"] },
  { option: "leg-finish", choices: ["hem"] },
  { option: "gusset" },
  { option: "side-stripe" },
  { option: "pockets", choices: ["none", "side-seam"], default: "none" },
] as const;

/**
 * A team jersey's questions, with the choices the tops drawing supports for a jersey. The same
 * rule holds for every shirt here: it offers only what the tops drawing code can draw.
 */
const JERSEY_OPTIONS = [
  FIT,
  { option: "neckline" },
  { option: "collar", choices: ["none", "band-collar"] },
  { option: "placket" },
  { option: "sleeve-type" },
  { option: "sleeve-length" },
  { option: "hem-shape" },
  { option: "side-panels" },
  { option: "cuffs" },
] as const;

export const FOOTBALL_TYPES: readonly GarmentType[] = [
  { ...TOP, family: "football", id: "football-shirt", label: "Football shirt", options: JERSEY_OPTIONS },
  {
    ...TOP,
    family: "football",
    id: "goalkeeper-shirt",
    label: "Goalkeeper shirt",
    options: [
      FIT,
      { option: "neckline", choices: ["crew"] },
      { option: "collar", choices: ["none", "band-collar"] },
      { option: "placket", choices: ["none"] },
      { option: "sleeve-type" },
      { option: "sleeve-length", default: "long" },
      { option: "hem-shape" },
      NO_SIDE_PANELS,
      { option: "cuffs" },
      { option: "elbow-pads" },
    ],
  },
  { ...BOTTOM, family: "football", id: "football-shorts", label: "Football shorts", options: SHORTS_OPTIONS },
  {
    wearers: WEARERS,
    family: "football",
    id: "football-socks",
    label: "Football socks",
    pointsOfMeasure: ids(SOCK_POINTS_OF_MEASURE),
    panels: ids(SOCK_PANELS),
    options: [{ option: "sock-height" }, { option: "sock-top" }],
  },
  {
    ...TOP,
    family: "football",
    id: "football-training-top",
    label: "Football training top",
    options: [
      FIT,
      { option: "neckline" },
      { option: "collar", choices: ["none"] },
      { option: "placket", choices: ["none", "zip"] },
      { option: "sleeve-type" },
      { option: "sleeve-length", default: "long" },
      { option: "hem-shape", choices: ["straight", "curved"] },
      NO_SIDE_PANELS,
      { option: "cuffs" },
    ],
  },
];

export const CRICKET_TYPES: readonly GarmentType[] = [
  {
    ...TOP,
    family: "cricket",
    id: "cricket-shirt",
    label: "Cricket shirt, coloured",
    options: [
      FIT,
      { option: "neckline", choices: ["crew"] },
      { option: "collar", choices: ["polo-collar"], default: "polo-collar" },
      { option: "placket", choices: ["buttons", "zip"], default: "buttons" },
      { option: "sleeve-type", choices: ["set-in"] },
      { option: "sleeve-length" },
      { option: "hem-shape" },
      NO_SIDE_PANELS,
      { option: "cuffs" },
    ],
  },
  {
    ...BOTTOM,
    family: "cricket",
    id: "cricket-trousers",
    label: "Cricket trousers",
    options: [
      FIT,
      { option: "leg-length", choices: ["full"] },
      { option: "waistband", choices: ["elastic", "elastic-drawcord"], default: "elastic" },
      { option: "leg-finish", choices: ["hem"] },
      { option: "gusset", choices: ["none"] },
      { option: "side-stripe" },
      { option: "pockets", choices: ["side-seam", "zip-side", "none"], default: "side-seam" },
    ],
  },
  {
    ...TOP,
    family: "cricket",
    id: "cricket-training-tee",
    label: "Cricket training tee",
    options: [
      FIT,
      { option: "neckline", choices: ["crew", "v-neck"] },
      { option: "collar", choices: ["none"] },
      { option: "placket", choices: ["none"] },
      { option: "sleeve-type" },
      { option: "sleeve-length" },
      { option: "hem-shape", choices: ["straight", "curved"] },
      NO_SIDE_PANELS,
      { option: "cuffs", choices: ["none"] },
    ],
  },
  {
    wearers: WEARERS,
    family: "cricket",
    id: "cricket-cap",
    label: "Cricket cap",
    pointsOfMeasure: ids(CAP_POINTS_OF_MEASURE),
    panels: ids(CAP_PANELS),
    options: [{ option: "cap-shape" }, { option: "cap-adjuster" }],
  },
];

export const WINTER_CODE_TYPES: readonly GarmentType[] = [
  {
    ...TOP,
    family: "winter-code",
    id: "winter-code-top",
    label: "Team top, winter code",
    options: [...JERSEY_OPTIONS, { option: "winter-code" }],
  },
];
