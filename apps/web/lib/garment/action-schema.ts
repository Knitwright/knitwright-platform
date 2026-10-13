import { z } from "zod";
import {
  artworkSchema,
  colourwaySchema,
  COMPONENT_TEXT_MAX_LENGTH,
  fabricSchema,
  measurementShape,
  sizeLabelSchema,
  sizeMeasurementSchema,
  sizingSchema,
  toleranceSchema,
} from "./parts";
import { fabricChangesSchema } from "./fabric-edit";
import { kitPatternSchema } from "./kit-pattern";
import { namesAndNumbersSchema } from "./names-numbers";
import { freeText, kebabId, localId, wearerSchema } from "./primitives";
import { provenanceSchema } from "./provenance";
import { componentSchema, constructionEntrySchema, labellingFieldSchema } from "./tech-parts";

/**
 * Every change the editor, and later the assistant, may ask for. Anything else is
 * refused before it touches a design. Unknown fields are refused too. Actions that set
 * a value carry its provenance: the option choice, the measurement, and the fabric,
 * colourway and artwork objects each hold their own. The wearer and the garment type
 * carry none, because a person always chooses them.
 */
export const specActionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("set-option"),
    optionId: kebabId,
    choiceId: kebabId,
    provenance: provenanceSchema,
  }),
  z.strictObject({ type: z.literal("set-measurement"), ...measurementShape }),
  z.strictObject({ type: z.literal("remove-measurement"), pointId: kebabId }),
  z.strictObject({ type: z.literal("set-sizing"), sizing: sizingSchema.nullable() }),
  /** A value for a size other than the base size, typed because nothing can work it out. */
  z.strictObject({ type: z.literal("set-size-measurement"), entry: sizeMeasurementSchema }),
  z.strictObject({ type: z.literal("remove-size-measurement"), pointId: kebabId, size: sizeLabelSchema }),
  z.strictObject({ type: z.literal("set-tolerance"), entry: toleranceSchema }),
  z.strictObject({ type: z.literal("remove-tolerance"), pointId: kebabId }),
  z.strictObject({ type: z.literal("add-fabric"), fabric: fabricSchema }),
  z.strictObject({ type: z.literal("update-fabric"), fabric: fabricSchema }),
  z.strictObject({
    type: z.literal("change-fabric"),
    id: localId,
    changes: fabricChangesSchema,
    /** The source of the fields listed in `changes`, and of no others. */
    provenance: provenanceSchema,
  }),
  z.strictObject({ type: z.literal("remove-fabric"), id: localId }),
  z.strictObject({ type: z.literal("assign-fabric"), panelId: kebabId, fabricId: localId }),
  z.strictObject({ type: z.literal("add-colourway"), colourway: colourwaySchema }),
  z.strictObject({ type: z.literal("update-colourway"), colourway: colourwaySchema }),
  z.strictObject({ type: z.literal("remove-colourway"), id: localId }),
  z.strictObject({ type: z.literal("add-artwork"), artwork: artworkSchema }),
  z.strictObject({ type: z.literal("update-artwork"), artwork: artworkSchema }),
  z.strictObject({ type: z.literal("remove-artwork"), id: localId }),
  z.strictObject({ type: z.literal("set-names-numbers"), namesAndNumbers: namesAndNumbersSchema }),
  z.strictObject({ type: z.literal("remove-names-numbers") }),
  z.strictObject({ type: z.literal("set-kit-pattern"), kitPattern: kitPatternSchema }),
  z.strictObject({ type: z.literal("remove-kit-pattern") }),
  z.strictObject({ type: z.literal("set-component"), component: componentSchema }),
  z.strictObject({ type: z.literal("remove-component"), id: kebabId }),
  z.strictObject({ type: z.literal("set-construction"), entry: constructionEntrySchema }),
  z.strictObject({ type: z.literal("remove-construction"), seamId: kebabId }),
  z.strictObject({
    type: z.literal("set-labelling"),
    field: labellingFieldSchema,
    /** Empty text removes the field. */
    text: freeText(COMPONENT_TEXT_MAX_LENGTH),
    provenance: provenanceSchema,
  }),
  z.strictObject({ type: z.literal("change-wearer"), wearer: wearerSchema }),
  z.strictObject({ type: z.literal("change-type"), typeId: kebabId }),
]);

export type SpecAction = z.output<typeof specActionSchema>;
