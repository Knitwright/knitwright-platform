import { z } from "zod";

import { CONFIRM_MESSAGE, CONFIRM_WORD } from "./confirm";

export { CONFIRM_MESSAGE, CONFIRM_WORD };

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
