import { getType, type GarmentSpec } from "@/lib/garment";
import { colourwayFor } from "./colour";
import { NOT_TO_SCALE_MISFIT, NOT_TO_SCALE_MISSING, type View } from "./model";

const VIEW_WORDS: Readonly<Record<View, string>> = { front: "Front view", back: "Back view" };

const SHOWN_ON: Readonly<Record<View, readonly string[]>> = {
  front: ["body-front", "sleeve-left", "sleeve-right"],
  back: ["body-back"],
};

/** "Artwork: Club badge on Body front, Left chest." for the artwork this view shows. */
function artworkSentence(spec: GarmentSpec, type: NonNullable<ReturnType<typeof getType>>, view: View): string[] {
  return spec.artwork
    .filter((item) => SHOWN_ON[view].includes(item.panelId))
    .map((item) => {
      const panel = type.panels.find((candidate) => candidate.id === item.panelId);
      const place = panel?.anchors.find((anchor) => anchor.id === item.anchor)?.label ?? item.anchor;
      return `${item.name} on ${panel?.label ?? item.panelId}, ${place}`;
    })
    .map((line) => `Artwork: ${line}.`);
}

/**
 * The drawing in words, from the registry and the design: the type, the wearer, each
 * choice, and the colours the person named. It is the text alternative of the picture.
 */
export function describeFlat(spec: GarmentSpec, view: View, colourwayId: string, notice: string | null): string {
  const type = getType(spec.typeId);
  if (!type) return `${VIEW_WORDS[view]} of a garment.`;
  const choices = type.options
    .filter((option) => option.id !== "fit")
    .flatMap((option) => {
      const choice = option.choices.find((entry) => entry.id === spec.options[option.id]?.choiceId);
      return choice ? [`${option.label}: ${choice.label}.`] : [];
    });
  const named = colourwayFor(spec, colourwayId).colours.flatMap((entry) => {
    const panel = type.panels.find((candidate) => candidate.id === entry.panelId);
    return panel ? [`${panel.label} ${entry.colour || entry.swatch}`] : [];
  });
  const artwork = artworkSentence(spec, type, view);
  const colours = named.length > 0 ? [`Colours: ${named.join(", ")}.`] : [];
  const scale = notice === NOT_TO_SCALE_MISSING || notice === NOT_TO_SCALE_MISFIT ? [notice] : [];
  return [`${VIEW_WORDS[view]}.`, `${type.label} for ${spec.wearer}.`, ...choices, ...colours, ...artwork, ...scale].join(" ");
}
