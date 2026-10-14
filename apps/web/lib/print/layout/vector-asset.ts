import { z } from "zod";
import type { Pt } from "../geometry/vec";
import type { Shape } from "../geometry/boolean";

/**
 * The vector copy of an uploaded logo as the print files read it: shapes with solid fills, in the logo's own units,
 * y down. This is the print files' side of the contract with the artwork intake (W7b), which stores a vector upload as
 * JSON and never as SVG. Phase B adapts this reader to the intake's restricted model (decision 0036); until then the
 * tests and the fake reader use this shape.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const ring = z.array(z.tuple([z.number().finite(), z.number().finite()])).min(3).max(20_000);

export const vectorCopySchema = z.object({
  kind: z.literal("vector"),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  shapes: z.array(z.object({ rings: z.array(ring).min(1).max(64), fill: hex })).min(1).max(5000),
});
export type VectorCopy = z.output<typeof vectorCopySchema>;

export function parseVectorCopy(bytes: Uint8Array): VectorCopy | null {
  try {
    const parsed = vectorCopySchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const encodeVectorCopy = (copy: VectorCopy): Uint8Array => new TextEncoder().encode(JSON.stringify(copy));

export type FilledRings = { readonly fill: string; readonly shape: Shape };
export const ringsOf = (copy: VectorCopy): { fill: string; rings: Pt[][] }[] => copy.shapes.map((s) => ({ fill: s.fill.toLowerCase(), rings: s.rings.map((r) => r.map(([x, y]): Pt => [x, y])) }));
