import type { FamilyData } from "../definitions";
import { FAMILY_IDS, type FamilyId } from "../primitives";
import { buildRegistry, type ResolvedType } from "./build";
import { BOTTOMS } from "./bottoms";
import { TOPS } from "./tops";

export type { Registry, ResolvedOption, ResolvedType } from "./build";
export { buildRegistry, checkFamilyData } from "./build";
export { SEAM_CLASSES, STITCH_CLASSES } from "./construction-classes";

/**
 * ADDING A FAMILY (bottoms, outerwear or close-fitting) takes these steps.
 * 1. Write its data in a folder like `registry/tops/`: options, points of measure,
 *    panels, rules and types, gathered into one `FamilyData` object.
 * 2. Replace its `emptyFamily(...)` line below with that object.
 * 3. If the family id is new to the code, add it to `FAMILY_IDS` in `primitives.ts`.
 *    The compiler then insists on an entry below, because `FAMILIES` must cover every id.
 * The code that reads the registry does not change. But this is not only data: steps 2
 * and 3 are small code edits, and new data must pass `checkFamilyData` or startup fails.
 */
const emptyFamily = (id: FamilyId, label: string): FamilyData => ({
  id,
  label,
  options: [],
  pointsOfMeasure: [],
  panels: [],
  rules: [],
  seams: [],
  components: [],
  types: [],
});

const FAMILIES: Readonly<Record<FamilyId, FamilyData>> = {
  tops: TOPS,
  bottoms: BOTTOMS,
  outerwear: emptyFamily("outerwear", "Outerwear"),
  "close-fitting": emptyFamily("close-fitting", "Close fitting"),
};

/** The data of every family, in the order of `FAMILY_IDS`. Tests read it to check each family. */
export const FAMILY_DATA: readonly FamilyData[] = FAMILY_IDS.map((id) => FAMILIES[id]);

const REGISTRY = buildRegistry(FAMILY_DATA);

export const getType = (id: string): ResolvedType | undefined => REGISTRY.getType(id);
export const listTypes = (family?: FamilyId): readonly ResolvedType[] => [...REGISTRY.listTypes(family)];
export const listFamilies = (): ReturnType<typeof REGISTRY.listFamilies> => [...REGISTRY.listFamilies()];
