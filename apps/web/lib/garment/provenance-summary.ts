import { choiceName, panelName, pointName } from "./labels";
import { LABELLING_FIELDS, LABELLING_LABELS } from "./tech-parts";
import type { Provenance } from "./provenance";
import { getType } from "./registry";
import type { GarmentSpec } from "./spec-schema";

/** Values the tech pack must list, because a person did not type them in. */
const LISTED: readonly Provenance[] = ["ai-suggested", "read-from-image", "suggested-chart"];

export interface ProvenanceItem {
  readonly kind: "option" | "measurement" | "fabric" | "colour" | "artwork" | "component" | "construction" | "labelling";
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
    ...spec.components.map((entry) => ({
      kind: "component" as const,
      id: entry.id,
      label: type.components.find((slot) => slot.id === entry.id)?.label ?? entry.id,
      provenance: entry.provenance,
    })),
    ...spec.construction.map((entry) => ({
      kind: "construction" as const,
      id: entry.seamId,
      label: type.seams.find((seam) => seam.id === entry.seamId)?.label ?? entry.seamId,
      provenance: entry.provenance,
    })),
    ...LABELLING_FIELDS.flatMap((field) => {
      const value = spec.labelling[field];
      return value ? [{ kind: "labelling" as const, id: field, label: LABELLING_LABELS[field], provenance: value.provenance }] : [];
    }),
  ];
  return items.filter((item) => LISTED.includes(item.provenance));
}
