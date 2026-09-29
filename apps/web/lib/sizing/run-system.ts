import { USUAL_SIZE_SYSTEM, listSizeSystems, sizeSystemFor, type Wearer } from "@/lib/garment";
import type { SizeRun } from "./schemas";

/** The size system of a run. A run that names none uses the usual system of its wearer. */
export const systemOfRun = (run: SizeRun): string => run.system ?? USUAL_SIZE_SYSTEM[run.wearer];

/** The system a type needs for a wearer. An unknown type, or wearer, falls back to the usual one. */
const neededSystem = (typeId: string, wearer: Wearer): string => sizeSystemFor(typeId, wearer)?.id ?? USUAL_SIZE_SYSTEM[wearer];

const labelOf = (systemId: string): string =>
  listSizeSystems().find((system) => system.id === systemId)?.label ?? systemId;

/** True when the run is for this wearer and uses the size system the type needs for them. */
export const runSuits = (run: SizeRun, typeId: string, wearer: Wearer): boolean =>
  run.wearer === wearer && systemOfRun(run) === neededSystem(typeId, wearer);

/** A plain sentence when the run uses another size system than the type needs, otherwise null. */
export function runSystemMismatch(run: SizeRun, typeId: string, wearer: Wearer): string | null {
  const needed = neededSystem(typeId, wearer);
  const has = systemOfRun(run);
  if (has === needed) return null;
  return `The size run ${run.id} uses ${labelOf(has)}, but this garment for ${wearer} is sized in ${labelOf(needed)}.`;
}

/** What to say when no run of the right wearer and size system was sent. */
export function missingRunMessage(typeId: string, wearer: Wearer): string {
  const needed = neededSystem(typeId, wearer);
  if (needed === USUAL_SIZE_SYSTEM[wearer]) {
    return `There is no size run for ${wearer}. Send the sizes for ${wearer}, smallest first.`;
  }
  return `There is no size run of ${labelOf(needed)} for ${wearer}. Send those sizes for ${wearer}, smallest first.`;
}
