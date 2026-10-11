import { z } from "zod";
import { WEARERS, getType, type Wearer } from "@/lib/garment";
import { isOffered, notOfferedReason } from "@/lib/config/launch-garments";
import { notOfferedTypeNamed } from "@/lib/intent/launch-scope";
import { MAX_UTTERANCE_LENGTH } from "@/lib/intent/text-flow";
import { DEFAULT_START, startFromSentence, suggestedName, type GuideOptions } from "./flow";

/**
 * How the guided flow starts a design (plan step 15, task 1). A sentence starts from the garment
 * it names and is then sent to the assistant; a sketch starts from a crew neck tee that the
 * sketch then changes; the picker starts from the garment chosen.
 */

const SAY_SOMETHING = "Say in a few words what you want to make.";
const PICK_A_GARMENT = "Choose a garment type.";

const OTHER_GARMENT = "Describe another garment, or pick one from the list.";

/** A sentence that names a garment not offered yet gets that answer, never another garment. */
const sentence = z
  .string()
  .trim()
  .min(1, SAY_SOMETHING)
  .max(MAX_UTTERANCE_LENGTH, `Keep it under ${MAX_UTTERANCE_LENGTH} characters.`)
  .superRefine((text, context) => {
    const named = notOfferedTypeNamed(text);
    if (named !== undefined) context.addIssue({ code: "custom", message: `${notOfferedReason(named)} ${OTHER_GARMENT}` });
  });

/** A garment a new design may start as. One not offered yet is refused with that answer. */
export const offeredTypeSchema = z
  .string(PICK_A_GARMENT)
  .refine((id) => getType(id) !== undefined, PICK_A_GARMENT)
  .superRefine((id, context) => {
    if (getType(id) !== undefined && !isOffered(id)) {
      context.addIssue({ code: "custom", message: `${notOfferedReason(id)} Choose another garment.` });
    }
  });

export const guidedStartSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("text"), sentence }),
  z.object({ method: z.literal("sketch") }),
  z.object({
    method: z.literal("picker"),
    typeId: offeredTypeSchema,
    wearer: z.enum(WEARERS, "Choose who it is for."),
  }),
]);

export type GuidedStart = z.output<typeof guidedStartSchema>;

export interface GuidedStartPlan {
  readonly typeId: string;
  readonly wearer: Wearer;
  readonly name: string;
  /** What the first step of the guide is told: how the person started, and any sentence to send. */
  readonly next: GuideOptions;
}

export function planGuidedStart(input: GuidedStart): GuidedStartPlan {
  if (input.method === "text") {
    const start = startFromSentence(input.sentence);
    return { ...start, name: suggestedName(start.typeId), next: { from: "text", say: input.sentence } };
  }
  const start = input.method === "picker" ? { typeId: input.typeId, wearer: input.wearer } : DEFAULT_START;
  return { ...start, name: suggestedName(start.typeId), next: { from: input.method } };
}
