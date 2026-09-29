import { z } from "zod";
import {
  COMPONENT_TEXT_MAX_LENGTH,
  NAME_MAX_LENGTH,
  QUANTITY_MAX_LENGTH,
  STITCH_DENSITY_MAX_LENGTH,
} from "./parts";
import { freeText, kebabId } from "./primitives";
import { provenanceSchema } from "./provenance";

/**
 * The parts of a design that only the tech pack needs: what the user says about components,
 * about how seams are sewn, and about labels and packing. Each carries its source. None holds
 * a number that the program worked out: quantities and densities are the user's own words.
 */

/**
 * What the user says about a component the design implies, such as thread or buttons. The
 * id is the id of the registry slot. The quantity is free text with its unit, and is empty
 * until the user enters one.
 */
export const componentSchema = z
  .object({
    id: kebabId,
    name: freeText(NAME_MAX_LENGTH),
    details: freeText(COMPONENT_TEXT_MAX_LENGTH),
    quantity: freeText(QUANTITY_MAX_LENGTH),
    provenance: provenanceSchema,
  })
  .readonly()
  .refine((entry) => entry.name !== "" || entry.details !== "" || entry.quantity !== "", {
    message: "Enter a name, details or a quantity.",
    path: ["name"],
  });
export type ComponentEntry = z.output<typeof componentSchema>;

/**
 * What the user says about how a seam is sewn. A class left out means the registry
 * proposal stands. The stitch density is free text, empty until the user enters one.
 */
export const constructionEntrySchema = z
  .object({
    seamId: kebabId,
    seamClass: kebabId.optional(),
    stitchClass: kebabId.optional(),
    stitchDensity: freeText(STITCH_DENSITY_MAX_LENGTH),
    provenance: provenanceSchema,
  })
  .readonly()
  .refine((entry) => entry.seamClass !== undefined || entry.stitchClass !== undefined || entry.stitchDensity !== "", {
    message: "Change a class or enter a stitch density.",
    path: ["stitchDensity"],
  });
export type ConstructionEntry = z.output<typeof constructionEntrySchema>;

export const LABELLING_FIELDS = ["care", "composition", "origin", "fold", "bag"] as const;
export const labellingFieldSchema = z.enum(LABELLING_FIELDS);
export type LabellingField = z.output<typeof labellingFieldSchema>;

/** Plain names for the labelling fields, for screens and documents. */
export const LABELLING_LABELS: Readonly<Record<LabellingField, string>> = {
  care: "Care instructions",
  composition: "Composition label",
  origin: "Country of origin",
  fold: "How to fold",
  bag: "How to bag",
};

const labellingValue = z
  .object({ text: freeText(COMPONENT_TEXT_MAX_LENGTH).min(1, "Enter some text."), provenance: provenanceSchema })
  .readonly();
export type LabellingValue = z.output<typeof labellingValue>;

/** Each field the user has filled in, with its source. A field not filled in is left out. */
export const labellingSchema = z
  .strictObject({
    care: labellingValue.optional(),
    composition: labellingValue.optional(),
    origin: labellingValue.optional(),
    fold: labellingValue.optional(),
    bag: labellingValue.optional(),
  })
  .readonly();
export type Labelling = z.output<typeof labellingSchema>;
