import { z } from "zod";
import type { Ring } from "../scene";
import { HEX } from "../rules/colour";

/**
 * The vector print copy of an uploaded logo as the print files read it: straight-edged shapes in a box, y down.
 * The artwork intake (W7b) stores a restricted vector model as JSON, never SVG; its adapter writes this shape
 * (curves already flattened). Anything that does not match is refused with a sentence, never guessed at.
 */
const pointSchema = z.tuple([z.number().finite(), z.number().finite()]);
const colourSchema = z.string().regex(HEX);

const shapeSchema = z.object({
  fill: colourSchema.nullable(),
  stroke: z.object({ colour: colourSchema, widthMm: z.number().finite().positive().max(100) }).nullable(),
  rings: z.array(z.array(pointSchema).min(2).max(20_000)).min(1).max(200),
  closed: z.boolean(),
});

export const vectorArtSchema = z.object({
  version: z.literal(1),
  width: z.number().finite().positive().max(1_000_000),
  height: z.number().finite().positive().max(1_000_000),
  shapes: z.array(shapeSchema).min(1).max(2000),
});
export type VectorArt = z.output<typeof vectorArtSchema>;

export const VECTOR_REFUSED = "This logo could not be read as vector artwork, so it was left off.";

export function readVectorArt(bytes: Uint8Array): VectorArt | null {
  try {
    const parsed = vectorArtSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const ringsOf = (rings: readonly (readonly (readonly [number, number])[])[]): Ring[] => rings.map((ring) => ring);
