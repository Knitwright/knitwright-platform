import type { FamilyData, SizeSystem } from "../definitions";
import { FAMILY_IDS, type FamilyId, type Wearer } from "../primitives";
import { buildRegistry, type ResolvedType } from "./build";
import { BOTTOMS } from "./bottoms";
import { OUTERWEAR } from "./outerwear";
import { CLOSE_FITTING } from "./close-fitting";
import { SIZE_SYSTEMS } from "./size-systems";
import { CRICKET, FOOTBALL, WINTER_CODE } from "./teamwear";
import { TOPS } from "./tops";

export type { ResolvedOption, ResolvedType } from "./build";
export { buildRegistry, checkFamilyData } from "./build";
export { USUAL_SIZE_SYSTEM } from "./size-systems";

/**
 * ADDING A FAMILY takes these steps.
 * 1. Write its data in a folder like `registry/tops/`: options, points of measure,
 *    panels, rules, seams, components and types, gathered into one `FamilyData` object.
 * 2. List that object below.
 * 3. If the family id is new to the code, add it to `FAMILY_IDS` in `primitives.ts`.
 *    The compiler then insists on an entry below, because `FAMILIES` must cover every id.
 * New data must pass `checkFamilyData` or startup fails, and `families.test.ts` checks it.
 */
const FAMILIES: Readonly<Record<FamilyId, FamilyData>> = {
  tops: TOPS,
  bottoms: BOTTOMS,
  outerwear: OUTERWEAR,
  "close-fitting": CLOSE_FITTING,
  football: FOOTBALL,
  cricket: CRICKET,
  "winter-code": WINTER_CODE,
};

/** The data of every family, in the order of `FAMILY_IDS`. Tests read it to check each family. */
export const FAMILY_DATA: readonly FamilyData[] = FAMILY_IDS.map((id) => FAMILIES[id]);

const REGISTRY = buildRegistry(FAMILY_DATA);

export const getType = (id: string): ResolvedType | undefined => REGISTRY.getType(id);
export const listTypes = (family?: FamilyId): readonly ResolvedType[] => [...REGISTRY.listTypes(family)];
export const listFamilies = (): ReturnType<typeof REGISTRY.listFamilies> => [...REGISTRY.listFamilies()];

/** The size systems a size run can use. A copy, so the list cannot be changed. */
export const listSizeSystems = (): readonly SizeSystem[] => [...SIZE_SYSTEMS];

/**
 * The size system a type's size run must use for a wearer. Undefined for an unknown type, or
 * a wearer the type is not made for.
 */
export function sizeSystemFor(typeId: string, wearer: Wearer): SizeSystem | undefined {
  const id = REGISTRY.getType(typeId)?.sizeSystems[wearer];
  return id === undefined ? undefined : SIZE_SYSTEMS.find((system) => system.id === id);
}
