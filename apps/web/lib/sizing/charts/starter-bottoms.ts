/**
 * Knitwright starter charts for bottoms: shorts, joggers and track pants, for men, women and
 * youth. Garment measurements laid flat, so a waist or a leg is the width across, half of
 * the way round. In centimetres: [point, value at the base size, grade, tolerance].
 * Sources and the judgement behind each number: docs/sizing/starter-charts.md.
 */
import type { SizeChart } from "../schemas";
import { starterChart, withRows, type CmRow } from "./starter-rows";
import { MEN, WOMEN, YOUTH } from "./starter-runs";

/** Women, XS to 2XL: the 1, 1, 1.5, 1.5 and 1.5 inch steps of the women's shorts source. */
const WOMEN_WIDTH = [2.5, 2.5, 3.8, 3.8, 3.8] as const;
/** Youth, YXS to YXL: the youth shorts waist steps of 1.5, 1, 1.5 and 1.5 inches. */
const YOUTH_WAIST = [3.8, 2.5, 3.8, 3.8] as const;
const YOUTH_LEG = [1.3, 2.5, 1.3, 1.3] as const;

const MEN_SHORTS: readonly CmRow[] = [
  ["waist-relaxed", 37, 3.8, 1],
  ["waist-stretched", 61, 2.5, 1.5],
  ["waistband-height", 4.5, 0, 0.3],
  ["hip", 54, 2.5, 1],
  ["front-rise", 33.5, 1.3, 1],
  ["back-rise", 40, 1.3, 1],
  ["thigh", 35, 1.3, 0.6],
  ["leg-opening", 34, 1.3, 0.6],
  ["inseam", 23, [0, 0, 0, 0.6, 0.6, 0.6], 1],
  ["outseam", 52, [1.3, 1.3, 1.3, 1.9, 1.9, 1.9], 1],
];

const MEN_JOGGERS: readonly CmRow[] = [
  ["waist-relaxed", 38.5, 3.8, 1],
  ["waist-stretched", 58, 2.5, 1.5],
  ["waistband-height", 4.5, 0, 0.3],
  ["hip", 54, 2.5, 1],
  ["front-rise", 33.5, 1.3, 1],
  ["back-rise", 40, 1.3, 1],
  ["thigh", 32, 1.3, 0.6],
  ["knee", 22, 0.6, 0.6],
  ["leg-opening", 11.5, 0.5, 0.5],
  ["inseam", 70, [0, 1.3, 1.3, 1.3, 1.3, 1.3], 1],
  ["outseam", 101.5, [1.3, 2.6, 2.6, 2.6, 2.6, 2.6], 1],
];

const WOMEN_SHORTS: readonly CmRow[] = [
  ["waist-relaxed", 34.5, WOMEN_WIDTH, 1],
  ["waist-stretched", 57, 2.5, 1.5],
  ["waistband-height", 4, 0, 0.3],
  ["hip", 52, WOMEN_WIDTH, 1],
  ["front-rise", 28.5, 1, 1],
  ["back-rise", 36, 1, 1],
  ["thigh", 31, 1.3, 0.6],
  ["leg-opening", 30, 1.3, 0.6],
  ["inseam", 12.5, [0, 0, 0.6, 0, 0], 1],
  ["outseam", 38, [1, 1, 1.6, 1, 1], 1],
];

const WOMEN_JOGGERS: readonly CmRow[] = [
  ["waist-relaxed", 35, WOMEN_WIDTH, 1],
  ["waist-stretched", 52.5, 2.5, 1.5],
  ["waistband-height", 4, 0, 0.3],
  ["hip", 52, WOMEN_WIDTH, 1],
  ["front-rise", 29.5, 1, 1],
  ["back-rise", 37, 1, 1],
  ["thigh", 30, 1.3, 0.6],
  ["knee", 20.5, 0.6, 0.6],
  ["leg-opening", 10.5, 0.4, 0.5],
  ["inseam", 70, 0.6, 1],
  ["outseam", 97.5, 1.6, 1],
];

const YOUTH_SHORTS: readonly CmRow[] = [
  ["waist-relaxed", 31, YOUTH_WAIST, 1],
  ["waist-stretched", 43, 2.5, 1.5],
  ["waistband-height", 4.5, 0, 0.3],
  ["hip", 45, 3.2, 1],
  ["front-rise", 28.5, 2.5, 1],
  ["back-rise", 33, 2.5, 1],
  ["thigh", 27.5, YOUTH_LEG, 0.6],
  ["leg-opening", 26.5, YOUTH_LEG, 0.6],
  ["inseam", 22, 0.6, 1],
  ["outseam", 44.5, 2.5, 1],
];

const YOUTH_JOGGERS: readonly CmRow[] = [
  ["waist-relaxed", 31, YOUTH_WAIST, 1],
  ["waist-stretched", 43, 2.5, 1.5],
  ["waistband-height", 4, 0, 0.3],
  ["hip", 45, 3.2, 1],
  ["front-rise", 28.5, 2.5, 1],
  ["back-rise", 33, 2.5, 1],
  ["thigh", 25, 1.9, 0.6],
  ["knee", 18.5, 1, 0.6],
  ["leg-opening", 9.5, 0.5, 0.5],
  ["inseam", 57, 5, 1],
  ["outseam", 83.5, 7.5, 1],
];

export const STARTER_BOTTOMS: readonly SizeChart[] = [
  starterChart("shorts", "men", MEN, MEN_SHORTS),
  starterChart("shorts", "women", WOMEN, WOMEN_SHORTS),
  starterChart("shorts", "youth", YOUTH, YOUTH_SHORTS),
  starterChart("joggers", "men", MEN, MEN_JOGGERS),
  starterChart("joggers", "women", WOMEN, WOMEN_JOGGERS),
  starterChart("joggers", "youth", YOUTH, YOUTH_JOGGERS),
  starterChart(
    "track-pants",
    "men",
    MEN,
    withRows(MEN_JOGGERS, [
      ["leg-opening", 20, 0.6, 0.5],
      ["inseam", 81, [0, 1.3, 1.3, 1.3, 1.3, 1.3], 1],
      ["outseam", 112.5, [1.3, 2.6, 2.6, 2.6, 2.6, 2.6], 1],
    ]),
  ),
  starterChart(
    "track-pants",
    "women",
    WOMEN,
    withRows(WOMEN_JOGGERS, [
      ["leg-opening", 19, 0.6, 0.5],
      ["inseam", 76, 0.6, 1],
      ["outseam", 103.5, 1.6, 1],
    ]),
  ),
  starterChart(
    "track-pants",
    "youth",
    YOUTH,
    withRows(YOUTH_JOGGERS, [
      ["leg-opening", 17, 0.8, 0.5],
      ["inseam", 64, 5, 1],
      ["outseam", 90.5, 7.5, 1],
    ]),
  ),
];
