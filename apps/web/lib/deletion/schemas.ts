import { z } from "zod";

import { CONFIRM_MESSAGE, CONFIRM_WORD } from "./confirm";

export { CONFIRM_MESSAGE, CONFIRM_WORD };

/**
 * The typed word, shared by every form that deletes something a person cannot get back, so the
 * word, the message and what counts as typing it are decided once. `components/deletion/DeleteForm`
 * asks for it; a body without this field would make that box a decoration.
 */
export const confirmField = z
  .string(CONFIRM_MESSAGE)
  .trim()
  .toLowerCase()
  .refine((typed) => typed === CONFIRM_WORD, CONFIRM_MESSAGE);

export const deleteDesignSchema = z.object({
  projectId: z.uuid("That is not a design."),
  confirm: confirmField,
});

export const deleteAccountSchema = z.object({ confirm: confirmField });
