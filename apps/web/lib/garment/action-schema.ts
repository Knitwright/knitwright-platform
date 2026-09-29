import { z } from "zod";
import { artworkSchema, colourwaySchema, fabricSchema, measurementShape } from "./parts";
import { kebabId, localId, wearerSchema } from "./primitives";

/**
 * Every change the editor, and later the assistant, may ask for. Anything else is
 * refused before it touches a design. Unknown fields are refused too.
 */
export const specActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("set-option"), optionId: kebabId, choiceId: kebabId }),
  z.strictObject({ type: z.literal("set-measurement"), ...measurementShape }),
  z.strictObject({ type: z.literal("remove-measurement"), pointId: kebabId }),
  z.strictObject({ type: z.literal("add-fabric"), fabric: fabricSchema }),
  /** Carries the new provenance along with the new details. */
  z.strictObject({ type: z.literal("update-fabric"), fabric: fabricSchema }),
  z.strictObject({ type: z.literal("remove-fabric"), id: localId }),
  z.strictObject({ type: z.literal("assign-fabric"), panelId: kebabId, fabricId: localId }),
  z.strictObject({ type: z.literal("add-colourway"), colourway: colourwaySchema }),
  z.strictObject({ type: z.literal("update-colourway"), colourway: colourwaySchema }),
  z.strictObject({ type: z.literal("remove-colourway"), id: localId }),
  z.strictObject({ type: z.literal("add-artwork"), artwork: artworkSchema }),
  z.strictObject({ type: z.literal("update-artwork"), artwork: artworkSchema }),
  z.strictObject({ type: z.literal("remove-artwork"), id: localId }),
  z.strictObject({ type: z.literal("change-wearer"), wearer: wearerSchema }),
  z.strictObject({ type: z.literal("change-type"), typeId: kebabId }),
]);

export type SpecAction = z.output<typeof specActionSchema>;
