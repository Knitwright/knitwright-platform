/**
 * Knitwright starter charts for tops: crew neck tee, V neck tee, long sleeve tee, polo and
 * team jersey, for men, women and youth. Garment measurements laid flat, in centimetres:
 * [point, value at the base size, grade between sizes, tolerance plus or minus].
 * Sources and the judgement behind each number: docs/sizing/starter-charts.md.
 */
import type { SizeChart } from "../schemas";
import { starterChart, withRows, type CmRow } from "./starter-rows";
import { MEN, WOMEN, YOUTH } from "./starter-runs";

/** Men, XS to 3XL: 4 cm a size across the chest, 5 cm into 3XL. */
const MEN_CHEST = [4, 4, 4, 4, 4, 5] as const;
/** Men's polo and the athletic tees it is based on: 1.5 inches a size, 2 inches into 3XL. */
const MEN_POLO_CHEST = [3.8, 3.8, 3.8, 3.8, 3.8, 5.1] as const;
/** Women, XS to 2XL: 1 inch a size up to M, then 1.5 inches. */
const WOMEN_CHEST = [2.5, 2.5, 3.8, 3.8, 3.8] as const;
const WOMEN_LENGTH = [1.3, 1.3, 2.5, 2.5, 2.5] as const;
/** Youth, YXS to YXL: the youth tee steps of 1.5, 1.5, 1 and 1.5 inches. */
const YOUTH_CHEST = [3.8, 3.8, 2.5, 3.8] as const;

const MEN_TEE: readonly CmRow[] = [
  ["chest-width", 53, MEN_CHEST, 1],
  ["body-length", 73, 2.5, 1],
  ["shoulder-width", 45, 1.8, 0.6],
  ["sleeve-length", 21.5, 1, 0.6],
  ["armhole", 23.5, 1.3, 0.6],
  ["upper-arm", 20, 1, 0.6],
  ["sleeve-opening", 18, 0.8, 0.5],
  ["hem-width", 53, MEN_CHEST, 1],
  ["neck-width", 18, 0.6, 0.5],
  ["front-neck-drop", 8.5, 0.6, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
];

const MEN_POLO: readonly CmRow[] = [
  ["chest-width", 54.5, MEN_POLO_CHEST, 1],
  ["body-length", 76, 2.5, 1],
  ["shoulder-width", 46, 1.8, 0.6],
  ["sleeve-length", 24, 1, 0.6],
  ["armhole", 24, 1.3, 0.6],
  ["upper-arm", 20.5, 1, 0.6],
  ["sleeve-opening", 18, 0.8, 0.5],
  ["hem-width", 54.5, MEN_POLO_CHEST, 1],
  ["neck-width", 18, 0.5, 0.5],
  ["front-neck-drop", 8, 0.5, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
  ["collar-height", 7, 0, 0.3],
  ["placket-length", 14, 0, 0.5],
  ["placket-width", 3, 0, 0.2],
];

const MEN_JERSEY: readonly CmRow[] = [
  ["chest-width", 55, MEN_CHEST, 1],
  ["body-length", 74, 2.5, 1],
  ["shoulder-width", 46, 1.8, 0.6],
  ["sleeve-length", 22, 1, 0.6],
  ["armhole", 24, 1.3, 0.6],
  ["upper-arm", 20.5, 1, 0.6],
  ["sleeve-opening", 18.5, 0.8, 0.5],
  ["hem-width", 55, MEN_CHEST, 1],
  ["neck-width", 18, 0.6, 0.5],
  ["front-neck-drop", 9, 0.6, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
  ["collar-height", 3.5, 0, 0.3],
  ["placket-length", 14, 0, 0.5],
  ["placket-width", 3, 0, 0.2],
];

const WOMEN_TEE: readonly CmRow[] = [
  ["chest-width", 51, WOMEN_CHEST, 1],
  ["body-length", 66, WOMEN_LENGTH, 1],
  ["shoulder-width", 39, 1.3, 0.6],
  ["sleeve-length", 18.5, 0.8, 0.6],
  ["armhole", 21, 1, 0.6],
  ["upper-arm", 17, 0.8, 0.6],
  ["sleeve-opening", 15.5, 0.6, 0.5],
  ["hem-width", 51, WOMEN_CHEST, 1],
  ["neck-width", 17, 0.5, 0.5],
  ["front-neck-drop", 9.5, 0.5, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
];

const WOMEN_POLO: readonly CmRow[] = [
  ["chest-width", 52.5, WOMEN_CHEST, 1],
  ["body-length", 69, WOMEN_LENGTH, 1],
  ["shoulder-width", 39.5, 1.3, 0.6],
  ["sleeve-length", 20, 0.8, 0.6],
  ["armhole", 21.5, 1, 0.6],
  ["upper-arm", 17.5, 0.8, 0.6],
  ["sleeve-opening", 16, 0.6, 0.5],
  ["hem-width", 52.5, WOMEN_CHEST, 1],
  ["neck-width", 16.5, 0.5, 0.5],
  ["front-neck-drop", 7.5, 0.5, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
  ["collar-height", 6.5, 0, 0.3],
  ["placket-length", 12, 0, 0.5],
  ["placket-width", 2.5, 0, 0.2],
];

const WOMEN_JERSEY: readonly CmRow[] = [
  ["chest-width", 53, WOMEN_CHEST, 1],
  ["body-length", 67, WOMEN_LENGTH, 1],
  ["shoulder-width", 40, 1.3, 0.6],
  ["sleeve-length", 19.5, 0.8, 0.6],
  ["armhole", 22, 1, 0.6],
  ["upper-arm", 18, 0.8, 0.6],
  ["sleeve-opening", 16.5, 0.6, 0.5],
  ["hem-width", 53, WOMEN_CHEST, 1],
  ["neck-width", 17, 0.5, 0.5],
  ["front-neck-drop", 10, 0.5, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
  ["collar-height", 3, 0, 0.3],
  ["placket-length", 12, 0, 0.5],
  ["placket-width", 2.5, 0, 0.2],
];

const YOUTH_TEE: readonly CmRow[] = [
  ["chest-width", 43, YOUTH_CHEST, 1],
  ["body-length", 58.5, 5.1, 1],
  ["shoulder-width", 36, 1.5, 0.5],
  ["sleeve-length", 17.5, 1.3, 0.5],
  ["armhole", 18.5, 1, 0.5],
  ["upper-arm", 15.5, 0.8, 0.5],
  ["sleeve-opening", 14, 0.8, 0.5],
  ["hem-width", 43, YOUTH_CHEST, 1],
  ["neck-width", 15, 0.5, 0.5],
  ["front-neck-drop", 7, 0.5, 0.5],
  ["back-neck-drop", 1.5, 0, 0.3],
];

const YOUTH_POLO_CHEST = [1.9, 2.5, 2.5, 3.8] as const;

const YOUTH_POLO: readonly CmRow[] = [
  ["chest-width", 43, YOUTH_POLO_CHEST, 1],
  ["body-length", 56, [5.1, 6.4, 6.4, 6.4], 1],
  ["shoulder-width", 36.5, 1.5, 0.5],
  ["sleeve-length", 19, 0.8, 0.5],
  ["armhole", 19, 1, 0.5],
  ["upper-arm", 16, 0.8, 0.5],
  ["sleeve-opening", 14.5, 0.8, 0.5],
  ["hem-width", 43, YOUTH_POLO_CHEST, 1],
  ["neck-width", 15, 0.5, 0.5],
  ["front-neck-drop", 6.5, 0.5, 0.5],
  ["back-neck-drop", 1.5, 0, 0.3],
  ["collar-height", 6, 0, 0.3],
  ["placket-length", 11, 0, 0.5],
  ["placket-width", 2.5, 0, 0.2],
];

const YOUTH_JERSEY: readonly CmRow[] = [
  ["chest-width", 45.5, 3.8, 1],
  ["body-length", 59, 2.5, 1],
  ["shoulder-width", 37, 1.5, 0.5],
  ["sleeve-length", 18, 1.3, 0.5],
  ["armhole", 19, 1, 0.5],
  ["upper-arm", 16, 0.8, 0.5],
  ["sleeve-opening", 14.5, 0.8, 0.5],
  ["hem-width", 45.5, 3.8, 1],
  ["neck-width", 15, 0.5, 0.5],
  ["front-neck-drop", 8, 0.5, 0.5],
  ["back-neck-drop", 1.5, 0, 0.3],
  ["collar-height", 3, 0, 0.3],
  ["placket-length", 11, 0, 0.5],
  ["placket-width", 2.5, 0, 0.2],
];

export const STARTER_TOPS: readonly SizeChart[] = [
  starterChart("crew-tee", "men", MEN, MEN_TEE),
  starterChart("crew-tee", "women", WOMEN, WOMEN_TEE),
  starterChart("crew-tee", "youth", YOUTH, YOUTH_TEE),
  starterChart("v-neck-tee", "men", MEN, withRows(MEN_TEE, [["front-neck-drop", 15, 0.6, 0.5]])),
  starterChart("v-neck-tee", "women", WOMEN, withRows(WOMEN_TEE, [["front-neck-drop", 14, 0.5, 0.5]])),
  starterChart("v-neck-tee", "youth", YOUTH, withRows(YOUTH_TEE, [["front-neck-drop", 11, 0.5, 0.5]])),
  starterChart(
    "long-sleeve-tee",
    "men",
    MEN,
    withRows(MEN_TEE, [
      ["sleeve-length", 65.5, 1, 1],
      ["sleeve-opening", 10.5, 0.5, 0.5],
    ]),
  ),
  starterChart(
    "long-sleeve-tee",
    "women",
    WOMEN,
    withRows(WOMEN_TEE, [
      ["sleeve-length", 61, 0.8, 1],
      ["sleeve-opening", 9.5, 0.4, 0.5],
    ]),
  ),
  starterChart(
    "long-sleeve-tee",
    "youth",
    YOUTH,
    withRows(YOUTH_TEE, [
      ["sleeve-length", 52, 1.8, 1],
      ["sleeve-opening", 8.5, 0.4, 0.5],
    ]),
  ),
  starterChart("polo", "men", MEN, MEN_POLO),
  starterChart("polo", "women", WOMEN, WOMEN_POLO),
  starterChart("polo", "youth", YOUTH, YOUTH_POLO),
  starterChart("team-jersey", "men", MEN, MEN_JERSEY),
  starterChart("team-jersey", "women", WOMEN, WOMEN_JERSEY),
  starterChart("team-jersey", "youth", YOUTH, YOUTH_JERSEY),
];
