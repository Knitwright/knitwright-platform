import { garmentSpecSchema, type GarmentSpec } from "@/lib/garment";
import { parseArtworkStack, writeStack } from "@/lib/artwork-stack";

export type NextDesign = { readonly ok: true; readonly spec: GarmentSpec } | { readonly ok: false; readonly reason: string };

/**
 * The design with this stack stored (the dual write of decision 0035). The stack arrives as JSON from a browser, so it is
 * read again with the stack's own rules, and the whole design is checked before it is stored. Pure.
 */
export function designWithStack(spec: GarmentSpec, stackJson: unknown, specVersion: number): NextDesign {
  const parsed = parseArtworkStack(stackJson);
  if (!parsed.ok) return parsed;
  const next = writeStack(spec, parsed.stack, specVersion);
  const checked = garmentSpecSchema.safeParse(next);
  return checked.success ? { ok: true, spec: checked.data } : { ok: false, reason: checked.error.issues[0]?.message ?? "This design cannot be saved." };
}
