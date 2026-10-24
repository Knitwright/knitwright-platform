import { z } from "zod";
import { KIT_PATTERN_STYLES } from "@/lib/garment";

/**
 * A change to a design, as the assistant may ask for it (plan v4 W2-B). Four kinds only. Every
 * object is strict, so a field this format does not have makes the reply unreadable.
 */

const id = z.string().min(1).max(64);

export const designDiffSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("set-colour"), panels: z.array(id).min(1).max(12), colour: z.string().min(1).max(60), swatch: z.string().max(9).optional() }),
  /** Down is towards the hem. `mm` is only ever a distance the person typed. */
  z.strictObject({
    kind: z.literal("move-placement"),
    artworkId: id,
    direction: z.enum(["up", "down", "left", "right"]),
    mm: z.number().finite().positive().max(500).optional(),
  }),
  z.strictObject({ kind: z.literal("swap-style"), style: z.enum(KIT_PATTERN_STYLES) }),
  z.strictObject({ kind: z.literal("change-option"), optionId: id, choiceId: id }),
]);
export type DesignDiff = z.output<typeof designDiffSchema>;

export const DIFF_KINDS = ["set-colour", "move-placement", "swap-style", "change-option"] as const satisfies readonly DesignDiff["kind"][];

/** The model's whole reply: a diff, or the statement that the request is not one of the four kinds. */
export const diffReplySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("diff"), diff: designDiffSchema }),
  z.strictObject({ kind: z.literal("unsupported") }),
]);
