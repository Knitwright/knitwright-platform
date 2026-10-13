import {
  DEFAULT_SAMPLE_NAME,
  DEFAULT_SAMPLE_NUMBER,
  cmToTenthsMm,
  getType,
  usualPlaces,
  type GarmentSpec,
  type PanelColour,
  type SpecAction,
} from "@/lib/garment";
import { readSwatch, swatchForName } from "./colour-names";
import type { WireAction } from "./reply-schema";

/** Everything a model sets is a suggestion until a person changes it (criterion M4). */
export const AI_SOURCE = "ai-suggested" as const;

/** A value read from a sketch or photo (plan step 13). It is a proposal until the person confirms it. */
export const IMAGE_SOURCE = "read-from-image" as const;

/** Where a model's value came from: a message, or a picture. */
export type ModelSource = typeof AI_SOURCE | typeof IMAGE_SOURCE;

export type Converted = { readonly ok: true; readonly action: SpecAction } | { readonly ok: false; readonly reason: string };

const done = (action: SpecAction): Converted => ({ ok: true, action });

type SetColour = Extract<WireAction, { type: "set-colour" }>;

/**
 * One panel's colour after the change. A colour given by name sets the factory name and a
 * drawn colour from the table of common names, so the flat shows it. A colour given as a code
 * sets only the drawn colour and keeps the factory name already there: a code picked for the
 * screen is not a colour reference for a factory.
 */
function panelColour(existing: PanelColour | undefined, panelId: string, wire: SetColour, source: ModelSource): PanelColour {
  const said = wire.colour.trim();
  const code = readSwatch(said);
  const named = said !== "" && code === null;
  const colour = named ? said : (existing?.colour ?? "");
  // A new name with no known colour drops the old drawn colour, which would show the wrong one.
  const swatch = wire.swatch ?? code ?? (named ? swatchForName(said) : existing?.swatch);
  return { panelId, colour, ...(swatch === undefined ? {} : { swatch }), provenance: source };
}

function setColour(spec: GarmentSpec, wire: SetColour, source: ModelSource): Converted {
  const colourway = wire.colourwayId
    ? spec.colourways.find((entry) => entry.id === wire.colourwayId)
    : spec.colourways[0];
  if (!colourway) return { ok: false, reason: "This design has no such colourway." };
  const named = new Set(wire.panels);
  const added = [...named].map((panelId) =>
    panelColour(colourway.colours.find((entry) => entry.panelId === panelId), panelId, wire, source),
  );
  const kept = colourway.colours.filter((entry) => !named.has(entry.panelId));
  return done({ type: "update-colourway", colourway: { ...colourway, colours: [...kept, ...added] } });
}

export const NO_PLACE_FOR_MARKS = "This garment has no place for player names or numbers.";

/**
 * Names and numbers at the usual places, with a sample to draw. Nothing else is chosen for the
 * person: style, colour, how they are made and every height stay unset. A design that has them
 * already keeps what it has.
 */
function addNamesNumbers(spec: GarmentSpec, source: ModelSource): Converted {
  if (spec.namesAndNumbers) return done({ type: "set-names-numbers", namesAndNumbers: spec.namesAndNumbers });
  const type = getType(spec.typeId);
  const places = type ? usualPlaces(type, spec.options) : [];
  if (places.length === 0) return { ok: false, reason: NO_PLACE_FOR_MARKS };
  return done({
    type: "set-names-numbers",
    namesAndNumbers: {
      places: places.map((place) => ({ place })),
      colour: "",
      sampleName: DEFAULT_SAMPLE_NAME,
      sampleNumber: DEFAULT_SAMPLE_NUMBER,
      provenance: source,
    },
  });
}

/**
 * Turns one change from a model into the change the editor makes, marked as suggested by
 * the assistant. It does not check the change; `applyAction` does that.
 */
export function toSpecAction(spec: GarmentSpec, wire: WireAction, source: ModelSource = AI_SOURCE): Converted {
  switch (wire.type) {
    case "set-option":
      return done({ type: "set-option", optionId: wire.optionId, choiceId: wire.choiceId, provenance: source });
    case "change-type":
      return done({ type: "change-type", typeId: wire.typeId });
    case "change-wearer":
      return done({ type: "change-wearer", wearer: wire.wearer });
    case "set-measurement":
      return done({
        type: "set-measurement",
        pointId: wire.pointId,
        value: cmToTenthsMm(wire.cm) ?? 0,
        provenance: source,
      });
    case "remove-measurement":
      return done({ type: "remove-measurement", pointId: wire.pointId });
    case "set-colour":
      return setColour(spec, wire, source);
    case "change-fabric":
      return done({
        type: "change-fabric",
        id: wire.fabricId ?? spec.fabrics[0].id,
        changes: wire.changes,
        provenance: source,
      });
    case "set-labelling":
      return done({ type: "set-labelling", field: wire.field, text: wire.text, provenance: source });
    case "add-names-numbers":
      return addNamesNumbers(spec, source);
    case "ask-amount":
      // Nothing to change until the person gives the amount. The resolver asks for it.
      return { ok: false, reason: "That needs an amount first." };
  }
}
