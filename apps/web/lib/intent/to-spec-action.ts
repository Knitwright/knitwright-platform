import { cmToTenthsMm, type GarmentSpec, type SpecAction } from "@/lib/garment";
import type { WireAction } from "./reply-schema";

/** Everything a model sets is a suggestion until a person changes it (criterion M4). */
export const AI_SOURCE = "ai-suggested" as const;

export type Converted = { readonly ok: true; readonly action: SpecAction } | { readonly ok: false; readonly reason: string };

const done = (action: SpecAction): Converted => ({ ok: true, action });

function setColour(spec: GarmentSpec, wire: Extract<WireAction, { type: "set-colour" }>): Converted {
  const colourway = wire.colourwayId
    ? spec.colourways.find((entry) => entry.id === wire.colourwayId)
    : spec.colourways[0];
  if (!colourway) return { ok: false, reason: `There is no colourway with the id ${wire.colourwayId}.` };
  const named = new Set(wire.panels);
  const colour = wire.colour.trim();
  const added = [...named].map((panelId) => ({
    panelId,
    colour,
    ...(wire.swatch === undefined ? {} : { swatch: wire.swatch }),
    provenance: AI_SOURCE,
  }));
  const kept = colourway.colours.filter((entry) => !named.has(entry.panelId));
  return done({ type: "update-colourway", colourway: { ...colourway, colours: [...kept, ...added] } });
}

/**
 * Turns one change from a model into the change the editor makes, marked as suggested by
 * the assistant. It does not check the change; `applyAction` does that.
 */
export function toSpecAction(spec: GarmentSpec, wire: WireAction): Converted {
  switch (wire.type) {
    case "set-option":
      return done({ type: "set-option", optionId: wire.optionId, choiceId: wire.choiceId, provenance: AI_SOURCE });
    case "change-type":
      return done({ type: "change-type", typeId: wire.typeId });
    case "change-wearer":
      return done({ type: "change-wearer", wearer: wire.wearer });
    case "set-measurement":
      return done({
        type: "set-measurement",
        pointId: wire.pointId,
        value: cmToTenthsMm(wire.cm) ?? 0,
        provenance: AI_SOURCE,
      });
    case "remove-measurement":
      return done({ type: "remove-measurement", pointId: wire.pointId });
    case "set-colour":
      return setColour(spec, wire);
    case "change-fabric":
      return done({
        type: "change-fabric",
        id: wire.fabricId ?? spec.fabrics[0].id,
        changes: wire.changes,
        provenance: AI_SOURCE,
      });
    case "set-labelling":
      return done({ type: "set-labelling", field: wire.field, text: wire.text, provenance: AI_SOURCE });
  }
}
