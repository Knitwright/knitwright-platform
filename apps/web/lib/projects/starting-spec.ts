import { applyAction, createSpec, type GarmentSpec, type Wearer } from "@/lib/garment";
import { sizingFromChart, type ChartSet } from "@/lib/sizing";

type StartingSpec =
  | Readonly<{ ok: true; spec: GarmentSpec }>
  | Readonly<{ ok: false; reason: string }>;

/**
 * The design a new project begins with: the type's starting choices, and the sizes of
 * the size chart that applies. While there are no charts, sizes stay empty and there
 * are no measurements. Nothing is made up.
 */
export const startingSpec = (typeId: string, wearer: Wearer, charts?: ChartSet): StartingSpec => {
  const created = createSpec(typeId, wearer);
  if (!created.ok) return created;
  const sizes = sizingFromChart(created.spec, charts);
  if (!sizes.ok) return created;
  const applied = applyAction(created.spec, sizes.action);
  return applied.ok ? { ok: true, spec: applied.spec } : created;
};
