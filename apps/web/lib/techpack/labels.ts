import { getType, type GarmentSpec } from "@/lib/garment";

/** The name people see for a panel, or its id when the garment has no such panel. */
export const panelLabelOf = (spec: Pick<GarmentSpec, "typeId">, panelId: string): string =>
  getType(spec.typeId)?.panels.find((panel) => panel.id === panelId)?.label ?? panelId;
