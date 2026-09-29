import type { Dropped } from "./dropped";
import { fabricFor } from "./fabric";
import { panelName } from "./labels";
import { getType } from "./registry";
import { panelsFor } from "./applicability";
import type { GarmentSpec } from "./spec-schema";

/**
 * Finds panels that use a different fabric after a change, without an entry being
 * removed for them. This happens when the first fabric goes, because every panel
 * with no entry follows it. Panels already reported as an assignment are skipped.
 */
export function fabricChanges(
  before: GarmentSpec,
  after: GarmentSpec,
  alreadyReported: readonly Dropped[],
): readonly Dropped[] {
  const type = getType(after.typeId);
  if (!type) return [];
  const reported = new Set(
    alreadyReported.filter((item) => item.kind === "fabric-assignment").map((item) => item.id),
  );
  const existed = new Set(panelsFor(before).map((panel) => panel.id));
  return panelsFor(after).flatMap((panel) => {
    if (!existed.has(panel.id) || reported.has(panel.id)) return [];
    const was = fabricFor(before, panel.id);
    const now = fabricFor(after, panel.id);
    if (was.id === now.id) return [];
    return [
      {
        kind: "fabric-change" as const,
        id: panel.id,
        message: `${panelName(type, panel.id)} now uses ${now.name} instead of ${was.name}.`,
      },
    ];
  });
}
