/**
 * Knitwright starter charts for the close-fitting garments offered at launch: the singlet and
 * the vest, for men, women and youth. The singlet is cut as a racing singlet, with narrower
 * straps and back; the vest as a straight-backed tank. Garment measurements laid flat, in
 * centimetres: [point, value at the base size, grade between sizes, tolerance].
 * Sources and the judgement behind each number: docs/sizing/starter-charts.md.
 */
import type { SizeChart } from "../schemas";
import { starterChart, withRows, type CmRow } from "./starter-rows";
import { MEN, WOMEN, YOUTH } from "./starter-runs";

const MEN_CHEST = [3.8, 3.8, 3.8, 3.8, 3.8, 5.1] as const;
/** The women's tank source grades 1, 1, 1.75, 1.75 and 2 inches. */
const WOMEN_CHEST = [2.5, 2.5, 4.4, 4.4, 5.1] as const;
const YOUTH_CHEST = [3.8, 3.8, 2.5, 3.8] as const;

const MEN_SINGLET: readonly CmRow[] = [
  ["chest-width", 53.5, MEN_CHEST, 1],
  ["body-length", 73.5, 2.5, 1],
  ["hem-width", 53.5, MEN_CHEST, 1],
  ["neck-width", 20, 0.5, 0.5],
  ["front-neck-drop", 11, 0.5, 0.5],
  ["back-neck-drop", 3, 0, 0.3],
  ["armhole-depth", 27, 1.3, 0.6],
  ["strap-width", 4.5, 0.3, 0.3],
  ["back-width-narrowest", 24, 1, 0.6],
];

const WOMEN_SINGLET: readonly CmRow[] = [
  ["chest-width", 43, WOMEN_CHEST, 1],
  ["body-length", 66, 1.3, 1],
  ["hem-width", 46, WOMEN_CHEST, 1],
  ["neck-width", 19, 0.5, 0.5],
  ["front-neck-drop", 11.5, 0.5, 0.5],
  ["back-neck-drop", 3, 0, 0.3],
  ["armhole-depth", 21, 0.8, 0.6],
  ["strap-width", 3.8, 0.3, 0.3],
  ["back-width-narrowest", 19, 1.3, 0.6],
];

const YOUTH_SINGLET: readonly CmRow[] = [
  ["chest-width", 43, YOUTH_CHEST, 1],
  ["body-length", 63, 5.1, 1],
  ["hem-width", 43, YOUTH_CHEST, 1],
  ["neck-width", 16.5, 0.5, 0.5],
  ["front-neck-drop", 9, 0.5, 0.5],
  ["back-neck-drop", 2.5, 0, 0.3],
  ["armhole-depth", 21, 1.3, 0.6],
  ["strap-width", 3.5, 0.3, 0.3],
  ["back-width-narrowest", 20, 1.3, 0.6],
];

export const STARTER_CLOSE_FITTING: readonly SizeChart[] = [
  starterChart("singlet", "men", MEN, MEN_SINGLET),
  starterChart("singlet", "women", WOMEN, WOMEN_SINGLET),
  starterChart("singlet", "youth", YOUTH, YOUTH_SINGLET),
  starterChart(
    "vest",
    "men",
    MEN,
    withRows(MEN_SINGLET, [
      ["front-neck-drop", 10, 0.5, 0.5],
      ["armhole-depth", 26, 1.3, 0.6],
      ["strap-width", 6, 0.3, 0.3],
      ["back-width-narrowest", 30, 1.3, 0.6],
    ]),
  ),
  starterChart(
    "vest",
    "women",
    WOMEN,
    withRows(WOMEN_SINGLET, [
      ["front-neck-drop", 10.5, 0.5, 0.5],
      ["armhole-depth", 20.5, 0.8, 0.6],
      ["strap-width", 5, 0.3, 0.3],
      ["back-width-narrowest", 25, 1.3, 0.6],
    ]),
  ),
  starterChart(
    "vest",
    "youth",
    YOUTH,
    withRows(YOUTH_SINGLET, [
      ["front-neck-drop", 8.5, 0.5, 0.5],
      ["armhole-depth", 20.5, 1.3, 0.6],
      ["strap-width", 4.5, 0.3, 0.3],
      ["back-width-narrowest", 24, 1.3, 0.6],
    ]),
  ),
];
