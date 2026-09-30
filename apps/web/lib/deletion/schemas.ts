import { z } from "zod";

/** The word a person types to confirm a deletion, which cannot be undone. */
export const CONFIRM_WORD = "delete";

export const CONFIRM_MESSAGE = `Type "${CONFIRM_WORD}" to confirm.`;

const confirmation = z
  .string(CONFIRM_MESSAGE)
  .trim()
  .toLowerCase()
  .refine((typed) => typed === CONFIRM_WORD, CONFIRM_MESSAGE);

export const deleteDesignSchema = z.object({
  projectId: z.uuid("That is not a design."),
  confirm: confirmation,
});

export const deleteAccountSchema = z.object({ confirm: confirmation });
