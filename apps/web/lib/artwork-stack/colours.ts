import { z } from "zod";
import { COLOUR_MAX_LENGTH, NAME_MAX_LENGTH, SWATCH_PATTERN } from "@/lib/garment/parts";
import { freeText, localId } from "@/lib/garment/primitives";
import { provenanceSchema } from "@/lib/garment/provenance";

/** The colour systems a person can name. No Pantone data ships (open item P6): a code is whatever the person typed. */
const COLOUR_SYSTEMS = ["factory", "pantone-tcx", "pantone-tpg", "ral", "custom"] as const;
export const COLOUR_SYSTEM_LABELS: Readonly<Record<(typeof COLOUR_SYSTEMS)[number], string>> = {
  factory: "Factory code",
  "pantone-tcx": "Pantone TCX",
  "pantone-tpg": "Pantone TPG",
  ral: "RAL",
  custom: "Colour name",
};

/** An id for a colour, layer or other part of a stack: lower case words joined by dashes. */
export const stackId = z
  .string()
  .max(80)
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "Use lower case words joined by dashes.");

const colourCodeSchema = z
  .object({ system: z.enum(COLOUR_SYSTEMS), value: freeText(COLOUR_MAX_LENGTH).min(1, "Enter the colour code."), source: provenanceSchema })
  .readonly();

/** What a colour is in one colourway. The screen colour is for drawings only; it is never a factory reference. */
const valueShape = {
  screen: z.string().regex(SWATCH_PATTERN, "Use a colour like #1b2a49.").optional(),
  codes: z.array(colourCodeSchema).max(4).readonly(),
  provenance: provenanceSchema,
};
export const colourValueSchema = z.object(valueShape).readonly();
export type ColourValue = z.output<typeof colourValueSchema>;

export const stackColourSchema = z.object({ id: stackId, role: freeText(40).min(1), ...valueShape }).readonly();
export type StackColour = z.output<typeof stackColourSchema>;

/** A colourway is a map from colour id to colour, so swapping it recolours the stack without touching a layer. */
export const stackColourwaySchema = z
  .object({ id: localId, name: freeText(NAME_MAX_LENGTH).min(1, "Give the colourway a name."), colours: z.record(stackId, colourValueSchema).readonly() })
  .readonly();
export type StackColourway = z.output<typeof stackColourwaySchema>;

interface WithColours {
  readonly colours: readonly StackColour[];
  readonly colourways: readonly StackColourway[];
}

/** A colour in a colourway; a colour the colourway does not name keeps the stack's own value. */
export function resolveColour(stack: WithColours, colourwayId: string | undefined, colourId: string): ColourValue | undefined {
  const base = stack.colours.find((entry) => entry.id === colourId);
  const chosen = stack.colourways.find((entry) => entry.id === colourwayId)?.colours[colourId];
  return chosen ?? (base === undefined ? undefined : { screen: base.screen, codes: base.codes, provenance: base.provenance });
}

/** A colour as a person reads it: the code as typed, else the screen colour, else a plain note. */
export function colourWords(value: ColourValue | undefined): string {
  const code = value?.codes[0];
  if (code !== undefined) return code.system === "custom" ? code.value : `${COLOUR_SYSTEM_LABELS[code.system]} ${code.value}`;
  return value?.screen === undefined ? "a colour not yet chosen" : `screen colour ${value.screen}`;
}
