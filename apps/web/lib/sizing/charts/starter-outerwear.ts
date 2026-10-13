/**
 * Knitwright starter charts for outerwear: pullover hoodie, zip hoodie and track jacket, for
 * men, women and youth. Garment measurements laid flat, in centimetres:
 * [point, value at the base size, grade between sizes, tolerance plus or minus].
 * A block holds every outerwear point; each chart keeps only the points its type can have.
 * Sources and the judgement behind each number: docs/sizing/starter-charts.md.
 */
import type { SizeChart } from "../schemas";
import { starterChart, withRows, type CmRow } from "./starter-rows";
import { MEN, WOMEN, YOUTH } from "./starter-runs";

/** Men's fleece, XS to 3XL: 1.5 inches a size, 2 inches into 3XL. */
const MEN_CHEST = [3.8, 3.8, 3.8, 3.8, 3.8, 5.1] as const;
/** A ribbed hem band sits at about 85 percent of the chest, so it grades at 85 percent too. */
const MEN_HEM = [3.2, 3.2, 3.2, 3.2, 3.2, 4.3] as const;
const WOMEN_HOODIE_CHEST = [2.5, 2.5, 3.2, 3.8, 3.8] as const;
const WOMEN_HOODIE_HEM = [2.1, 2.1, 2.7, 3.2, 3.2] as const;
const WOMEN_JACKET_CHEST = [2.5, 2.5, 3.8, 3.8, 3.8] as const;
const YOUTH_CHEST = [3.8, 3.8, 2.5, 3.8] as const;
const YOUTH_HEM = [3.2, 3.2, 2.1, 3.2] as const;
const YOUTH_SLEEVE = [6.8, 5.6, 5.6, 6.8] as const;

const MEN_HOODIE: readonly CmRow[] = [
  ["chest-width", 59.5, MEN_CHEST, 1],
  ["body-length", 72.5, 2.5, 1],
  ["shoulder-width", 49.5, 1.9, 0.6],
  ["sleeve-length", 62, 1, 1],
  ["armhole", 26, 0.6, 0.6],
  ["upper-arm", 22, 1, 0.6],
  ["sleeve-opening", 9.5, 0.4, 0.5],
  ["hem-width", 50.5, MEN_HEM, 1],
  ["neck-width", 20, 0.6, 0.5],
  ["front-neck-drop", 9.5, 0.3, 0.5],
  ["back-neck-drop", 2.5, 0, 0.3],
  ["hood-height", 38, [1.3, 1.3, 1.3, 1.3, 0.6, 0.6], 1],
  ["hood-width", 25, 0.6, 0.6],
  ["zip-length", 58, 2.5, 0.5],
  ["pocket-opening", 17.5, 0.6, 0.5],
  ["pocket-width", 30, 1, 0.6],
  ["pocket-height", 20, 0.5, 0.5],
  ["cuff-height", 5, 0, 0.3],
  ["hem-band-height", 5, 0, 0.3],
  ["collar-height", 6, 0, 0.3],
];

const MEN_JACKET = withRows(MEN_HOODIE, [
  ["chest-width", 61, 3.8, 1],
  ["body-length", 71, 2.5, 1],
  ["shoulder-width", 48, 1.8, 0.6],
  ["sleeve-length", 64, 1, 1],
  ["armhole", 25, 1, 0.6],
  ["sleeve-opening", 10, 0.5, 0.5],
  ["hem-width", 61, 3.8, 1],
  ["neck-width", 19, 0.5, 0.5],
  ["front-neck-drop", 6, 0.3, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
  ["zip-length", 64, 2.5, 0.5],
  ["pocket-opening", 17, 0.5, 0.5],
]);

const WOMEN_HOODIE: readonly CmRow[] = [
  ["chest-width", 53.5, WOMEN_HOODIE_CHEST, 1],
  ["body-length", 66, 1.3, 1],
  ["shoulder-width", 41, 1.3, 0.6],
  ["sleeve-length", 60, 0.8, 1],
  ["armhole", 23.5, 0.6, 0.6],
  ["upper-arm", 19, 0.8, 0.6],
  ["sleeve-opening", 9, 0.4, 0.5],
  ["hem-width", 46, WOMEN_HOODIE_HEM, 1],
  ["neck-width", 19, 0.5, 0.5],
  ["front-neck-drop", 9, 0.3, 0.5],
  ["back-neck-drop", 2.5, 0, 0.3],
  ["hood-height", 36, [1.3, 1.3, 1.3, 1.3, 0.6], 1],
  ["hood-width", 24, 0.6, 0.6],
  ["zip-length", 52, 1.3, 0.5],
  ["pocket-opening", 15.5, 0.6, 0.5],
  ["pocket-width", 27, 1, 0.6],
  ["pocket-height", 18.5, 0.5, 0.5],
  ["cuff-height", 5, 0, 0.3],
  ["hem-band-height", 5, 0, 0.3],
  ["collar-height", 5.5, 0, 0.3],
];

const WOMEN_JACKET = withRows(WOMEN_HOODIE, [
  ["chest-width", 51, WOMEN_JACKET_CHEST, 1],
  ["shoulder-width", 40, 1.3, 0.6],
  ["sleeve-length", 61, 0.8, 1],
  ["armhole", 23, 1, 0.6],
  ["upper-arm", 18.5, 0.8, 0.6],
  ["hem-width", 51, WOMEN_JACKET_CHEST, 1],
  ["neck-width", 18, 0.5, 0.5],
  ["front-neck-drop", 5.5, 0.3, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
  ["zip-length", 60, 1.3, 0.5],
]);

const YOUTH_HOODIE: readonly CmRow[] = [
  ["chest-width", 45.5, YOUTH_CHEST, 1],
  ["body-length", 58.5, 5.1, 1],
  ["shoulder-width", 38, 1.5, 0.5],
  ["sleeve-length", 53.5, YOUTH_SLEEVE, 1],
  ["armhole", 21, 1, 0.5],
  ["upper-arm", 17.5, 0.8, 0.5],
  ["sleeve-opening", 8, 0.4, 0.5],
  ["hem-width", 39, YOUTH_HEM, 1],
  ["neck-width", 17, 0.5, 0.5],
  ["front-neck-drop", 8, 0.3, 0.5],
  ["back-neck-drop", 2, 0, 0.3],
  ["hood-height", 32, 1, 1],
  ["hood-width", 22, 0.5, 0.6],
  ["zip-length", 46, 5.1, 0.5],
  ["pocket-opening", 14, 0.5, 0.5],
  ["pocket-width", 24, 1, 0.6],
  ["pocket-height", 16, 0.5, 0.5],
  ["cuff-height", 4.5, 0, 0.3],
  ["hem-band-height", 4.5, 0, 0.3],
  ["collar-height", 5, 0, 0.3],
];

const YOUTH_JACKET = withRows(YOUTH_HOODIE, [
  ["chest-width", 47, YOUTH_CHEST, 1],
  ["body-length", 57, 5.1, 1],
  ["shoulder-width", 38.5, 1.5, 0.5],
  ["sleeve-opening", 8.5, 0.4, 0.5],
  ["hem-width", 47, YOUTH_CHEST, 1],
  ["neck-width", 16.5, 0.5, 0.5],
  ["front-neck-drop", 5, 0.3, 0.5],
  ["zip-length", 52, 5.1, 0.5],
]);

export const STARTER_OUTERWEAR: readonly SizeChart[] = [
  starterChart("pullover-hoodie", "men", MEN, MEN_HOODIE),
  starterChart("pullover-hoodie", "women", WOMEN, WOMEN_HOODIE),
  starterChart("pullover-hoodie", "youth", YOUTH, YOUTH_HOODIE),
  starterChart("zip-hoodie", "men", MEN, MEN_HOODIE),
  starterChart("zip-hoodie", "women", WOMEN, WOMEN_HOODIE),
  starterChart("zip-hoodie", "youth", YOUTH, YOUTH_HOODIE),
  starterChart("track-jacket", "men", MEN, MEN_JACKET),
  starterChart("track-jacket", "women", WOMEN, WOMEN_JACKET),
  starterChart("track-jacket", "youth", YOUTH, YOUTH_JACKET),
];
