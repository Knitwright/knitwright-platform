"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/server/define-action";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { GARMENT_UNITS, saveLengthUnit } from "./preference";

const unitFormSchema = z.object({ unit: z.enum(GARMENT_UNITS, { error: "Choose millimetres, centimetres or inches." }) });

/** Keeps the unit the signed-in person reads garment lengths in (decision 0144). */
export const setLengthUnitAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.changeProfile,
  schema: unitFormSchema,
  handler: async ({ input, session }) => {
    await saveLengthUnit(adminClient(), session.userId, input.unit);
    revalidatePath("/", "layout");
    return { unit: input.unit };
  },
});
