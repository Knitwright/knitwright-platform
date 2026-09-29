import type { FabricSpec } from "./parts";
import type { GarmentSpec } from "./spec-schema";

/**
 * The fabric a panel uses. A panel with no entry uses the first fabric. A valid spec
 * always has one, and an entry naming a missing fabric also falls back to the first.
 */
export function fabricFor(
  spec: Pick<GarmentSpec, "fabrics" | "panelFabrics">,
  panelId: string,
): FabricSpec {
  const entry = spec.panelFabrics.find((assigned) => assigned.panelId === panelId);
  const chosen = entry && spec.fabrics.find((fabric) => fabric.id === entry.fabricId);
  return chosen ?? (spec.fabrics[0] as FabricSpec); // a valid spec always has a first fabric
}
