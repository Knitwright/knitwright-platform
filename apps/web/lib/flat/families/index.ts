import type { FamilyId, GarmentSpec } from "@/lib/garment";
import type { Proportions } from "../dimensions";
import { drawBottoms } from "./bottoms";
import { readBottomsOptions } from "./bottoms/options";
import { bottomsProportions } from "./bottoms/proportions";
import { drawCloseFitting } from "./close-fitting";
import { readCloseFitOptions } from "./close-fitting/options";
import { closeFitProportions } from "./close-fitting/proportions";
import type { FamilyDrawer } from "./drawing";
import { drawOuterwear } from "./outerwear";
import { readOuterwearOptions } from "./outerwear/options";
import { outerwearProportions } from "./outerwear/proportions";

/**
 * ADDING A FAMILY'S DRAWING. Write its drawing code in a folder here, like `bottoms/`, and list
 * its drawer and its proportions below. Tops keep their own templates in `templates/`.
 */
export const FAMILY_DRAWERS: Readonly<Partial<Record<FamilyId, FamilyDrawer>>> = {
  bottoms: drawBottoms,
  outerwear: drawOuterwear,
  "close-fitting": drawCloseFitting,
};

/** The ratios a family draws a design with when it has no measurements. Tests use them too. */
export const FAMILY_PROPORTIONS: Readonly<Partial<Record<FamilyId, (spec: GarmentSpec) => Proportions>>> = {
  bottoms: (spec) => bottomsProportions(readBottomsOptions(spec)),
  outerwear: (spec) => outerwearProportions(readOuterwearOptions(spec)),
  "close-fitting": (spec) => closeFitProportions(readCloseFitOptions(spec)),
};
