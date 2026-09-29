import { choiceName, panelName, pointName } from "./labels";
import type { Provenance } from "./provenance";
import { getType } from "./registry";
import type { GarmentSpec } from "./spec-schema";

/** Values the tech pack must list, because a person did not type them in. */
const LISTED: readonly Provenance[] = ["ai-suggested", "read-from-image", "suggested-chart"];

export interface ProvenanceItem {
  readonly kind: "option" | "measurement" | "fabric" | "colour" | "artwork";
  readonly id: string;
  /** For a colour, the id of its colourway. */
  readonly parentId?: string;
  readonly label: string;
  readonly provenance: Provenance;
}

/**
 * Every value in the spec that was suggested by the assistant, read from an image or
 * taken from a size chart, with a label for the tech pack page that lists them.
 */
export function provenanceSummary(spec: GarmentSpec): readonly ProvenanceItem[] {
  const type = getType(spec.typeId);
  if (!type) return [];
  const items: ProvenanceItem[] = [
    ...type.options.flatMap((option) => {
      const chosen = spec.options[option.id];
      return chosen
        ? [{ kind: "option" as const, id: option.id, label: `${option.label}: ${choiceName(option, chosen.choiceId)}`, provenance: chosen.provenance }]
        : [];
    }),
    ...spec.measurements.map((entry) => ({
      kind: "measurement" as const,
      id: entry.pointId,
      label: pointName(type, entry.pointId),
      provenance: entry.provenance,
    })),
    ...spec.fabrics.map((entry) => ({ kind: "fabric" as const, id: entry.id, label: entry.name, provenance: entry.provenance })),
    ...spec.colourways.flatMap((colourway) =>
      colourway.colours.map((entry) => ({
        kind: "colour" as const,
        id: entry.panelId,
        parentId: colourway.id,
        label: `${colourway.name}: ${panelName(type, entry.panelId)}`,
        provenance: entry.provenance,
      })),
    ),
    ...spec.artwork.map((entry) => ({ kind: "artwork" as const, id: entry.id, label: entry.name, provenance: entry.provenance })),
  ];
  return items.filter((item) => LISTED.includes(item.provenance));
}
