import { z } from "zod";
import type { ActionResult } from "./apply-action";
import {
  FABRIC_FIELDS,
  FABRIC_TEXT_MAX_LENGTH,
  FABRIC_WEIGHT_MAX_GSM,
  NAME_MAX_LENGTH,
  QUANTITY_MAX_LENGTH,
  STRETCH_VALUES,
  fabricFieldHasValue,
  type FabricSpec,
} from "./parts";
import { freeText } from "./primitives";
import { nonEmpty } from "./non-empty";
import type { Provenance } from "./provenance";
import type { GarmentSpec } from "./spec-schema";

/** The fields of a fabric that one change may set. A field left out is not touched. */
export const fabricChangesSchema = z
  .strictObject({
    name: freeText(NAME_MAX_LENGTH).min(1, "Give the fabric a name.").optional(),
    composition: freeText(FABRIC_TEXT_MAX_LENGTH).optional(),
    construction: freeText(FABRIC_TEXT_MAX_LENGTH).optional(),
    weightGsm: z.number().int().min(1).max(FABRIC_WEIGHT_MAX_GSM).nullable().optional(),
    finish: freeText(FABRIC_TEXT_MAX_LENGTH).optional(),
    consumption: freeText(QUANTITY_MAX_LENGTH).optional(),
    stretch: z.enum(STRETCH_VALUES).optional(),
  })
  .readonly()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: "Change at least one field.",
  });
export type FabricChanges = z.output<typeof fabricChangesSchema>;

/**
 * Sets the listed fields of one fabric, and gives only those fields the new source. A field
 * that is emptied loses its source. Fields left out keep the value and the source they had.
 */
export function changeFabric(
  spec: GarmentSpec,
  id: string,
  changes: FabricChanges,
  provenance: Provenance,
): ActionResult {
  const before = spec.fabrics.find((fabric) => fabric.id === id);
  if (!before) return { ok: false, reason: `There is no fabric with the id ${id}.` };
  const { name, ...fields } = changes;
  const merged = { ...before, ...(name === undefined ? {} : { name, provenance }) };
  const values = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  const withValues = { ...merged, ...values };
  const sources = Object.fromEntries(
    FABRIC_FIELDS.flatMap((field) => {
      if (!fabricFieldHasValue(withValues, field)) return [];
      const source = field in values ? provenance : before.sources[field];
      return source === undefined ? [] : [[field, source]];
    }),
  );
  const next: FabricSpec = { ...withValues, sources };
  const fabrics = nonEmpty(spec.fabrics.map((fabric) => (fabric.id === id ? next : fabric)));
  return fabrics ? { ok: true, spec: { ...spec, fabrics }, dropped: [] } : { ok: false, reason: "Keep at least one fabric." };
}
