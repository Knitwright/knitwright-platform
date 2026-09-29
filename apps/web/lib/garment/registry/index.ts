import type { FamilyData } from "../definitions";
import type { FamilyId } from "../primitives";
import { buildRegistry, type ResolvedType } from "./build";
import { TOPS } from "./tops";

export type { Registry, ResolvedOption, ResolvedType } from "./build";
export { buildRegistry, checkFamilyData } from "./build";

/**
 * A family with no types yet. Adding bottoms, outerwear or close-fitting garments is
 * a matter of replacing one of these with real data. No reading code changes.
 */
const emptyFamily = (id: FamilyId, label: string): FamilyData => ({
  id,
  label,
  options: [],
  pointsOfMeasure: [],
  panels: [],
  rules: [],
  types: [],
});

const REGISTRY = buildRegistry([
  TOPS,
  emptyFamily("bottoms", "Bottoms"),
  emptyFamily("outerwear", "Outerwear"),
  emptyFamily("close-fitting", "Close fitting"),
]);

export const getType = (id: string): ResolvedType | undefined => REGISTRY.getType(id);
export const listTypes = (family?: FamilyId): readonly ResolvedType[] => REGISTRY.listTypes(family);
export const listFamilies = (): ReturnType<typeof REGISTRY.listFamilies> => REGISTRY.listFamilies();
