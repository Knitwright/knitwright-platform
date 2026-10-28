import { z } from "zod";
import { conditionsHold } from "./conditions";
import { COLOUR_MAX_LENGTH, SWATCH_PATTERN, TECHNIQUES } from "./parts";
import { freeText } from "./primitives";
import { provenanceSchema } from "./provenance";
import type { ResolvedType } from "./registry";
import { MEASUREMENT_MAX_TENTHS_MM } from "./units";

/**
 * Player names and numbers (decision 0027). A design records only HOW they are put on: the
 * places, the lettering style, the colour, the way they are made and any heights typed. Each
 * player's own name and number belong to the team order, which is not built yet, so the
 * design holds one sample to draw. A height nobody typed stays unset: it is never guessed.
 */

/** The standard places, each on a named anchor of a panel. */
export const PLAYER_MARK_PLACES = ["back-name", "back-number", "front-number", "leg-number"] as const;
export type PlayerMarkPlace = (typeof PLAYER_MARK_PLACES)[number];

interface PlaceDefinition {
  readonly panelId: string;
  readonly anchor: string;
  /** What goes there: the name or the number. */
  readonly shows: "name" | "number";
  readonly label: string;
}

export const PLACE_DEFINITIONS: Readonly<Record<PlayerMarkPlace, PlaceDefinition>> = {
  "back-name": { panelId: "body-back", anchor: "upper-back", shows: "name", label: "Name across the upper back" },
  "back-number": { panelId: "body-back", anchor: "centre-back", shows: "number", label: "Number on the back, below the name" },
  "front-number": { panelId: "body-front", anchor: "centre-chest", shows: "number", label: "Number on the front" },
  "leg-number": { panelId: "legs-front", anchor: "left-thigh", shows: "number", label: "Number on the left leg" },
};

/** A small fixed set of lettering styles a factory can match. */
export const LETTERING_STYLES = ["block", "varsity", "rounded", "italic"] as const;
export type LetteringStyle = (typeof LETTERING_STYLES)[number];

export const LETTERING_LABELS: Readonly<Record<LetteringStyle, string>> = {
  block: "Block",
  varsity: "Varsity (college)",
  rounded: "Rounded",
  italic: "Italic",
};

export const SAMPLE_NAME_MAX_LENGTH = 20;
/** Team numbers run from 0 to 99, and some codes use 00. */
const SAMPLE_NUMBER_PATTERN = /^\d{1,2}$/;
export const DEFAULT_SAMPLE_NAME = "PLAYER";
export const DEFAULT_SAMPLE_NUMBER = "10";

const placeSchema = z
  .object({
    place: z.enum(PLAYER_MARK_PLACES),
    /** The height of the letters or digits, in tenths of a millimetre. Left out until typed. */
    height: z.number().int().min(1).max(MEASUREMENT_MAX_TENTHS_MM).optional(),
  })
  .readonly();
export type PlayerMarkPlacement = z.output<typeof placeSchema>;

export const namesAndNumbersSchema = z
  .object({
    places: z.array(placeSchema).min(1, "Choose at least one place.").max(PLAYER_MARK_PLACES.length).readonly(),
    /** Left out until someone chooses. */
    style: z.enum(LETTERING_STYLES).optional(),
    /** Free text, such as a Pantone name. May be empty. */
    colour: freeText(COLOUR_MAX_LENGTH),
    swatch: z.string().regex(SWATCH_PATTERN, "Use a colour like #1b2a49.").optional(),
    technique: z.enum(TECHNIQUES).optional(),
    /** What the drawing shows. Each player's own comes from the team order. */
    sampleName: freeText(SAMPLE_NAME_MAX_LENGTH).min(1, "Enter a sample name."),
    sampleNumber: z.string().regex(SAMPLE_NUMBER_PATTERN, "Enter a sample number from 0 to 99."),
    provenance: provenanceSchema,
  })
  .readonly()
  .refine((marks) => new Set(marks.places.map((entry) => entry.place)).size === marks.places.length, {
    message: "Each place can be chosen only once.",
    path: ["places"],
  });
export type NamesAndNumbers = z.output<typeof namesAndNumbersSchema>;

/** The places this garment, with these options, can carry. */
export function placesFor(type: ResolvedType, options: Parameters<typeof conditionsHold>[1]): readonly PlayerMarkPlace[] {
  return PLAYER_MARK_PLACES.filter((place) => {
    const { panelId, anchor } = PLACE_DEFINITIONS[place];
    const panel = type.panels.find((entry) => entry.id === panelId);
    return panel !== undefined && conditionsHold(panel.appliesWhen, options) && panel.anchors.some((entry) => entry.id === anchor);
  });
}

/** The places names and numbers start at: every one this garment has, except a front number. */
export const usualPlaces = (type: ResolvedType, options: Parameters<typeof conditionsHold>[1]): readonly PlayerMarkPlace[] =>
  placesFor(type, options).filter((place) => place !== "front-number");

/** Says why a place cannot be used on this garment, or null when every place fits. */
export function namesNumbersProblem(marks: NamesAndNumbers, type: ResolvedType, options: Parameters<typeof conditionsHold>[1]): string | null {
  const allowed = placesFor(type, options);
  const wrong = marks.places.find((entry) => !allowed.includes(entry.place));
  return wrong ? `${PLACE_DEFINITIONS[wrong.place].label} is not a place on ${type.label}.` : null;
}

/** The marks with only the places this garment can carry, or null when none is left. */
export function fittingMarks(marks: NamesAndNumbers, type: ResolvedType, options: Parameters<typeof conditionsHold>[1]): NamesAndNumbers | null {
  const allowed = placesFor(type, options);
  const places = marks.places.filter((entry) => allowed.includes(entry.place));
  return places.length === 0 ? null : { ...marks, places };
}

/** A copy of a design without names and numbers: the key is left out, as on a design that never had them. */
export function withoutMarks<T extends { readonly namesAndNumbers?: unknown }>(spec: T): Omit<T, "namesAndNumbers"> {
  return Object.fromEntries(Object.entries(spec).filter(([key]) => key !== "namesAndNumbers")) as Omit<T, "namesAndNumbers">;
}

/** The sample text for a place: the name or the number. */
export const sampleFor = (marks: NamesAndNumbers, place: PlayerMarkPlace): string =>
  PLACE_DEFINITIONS[place].shows === "name" ? marks.sampleName : marks.sampleNumber;
