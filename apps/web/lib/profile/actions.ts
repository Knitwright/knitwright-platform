"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/server/define-action";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { displayNameFormSchema } from "./name";

/**
 * Saves the name a person wants shown as "Made by" in their brands' tech packs, in their own
 * sign-in profile. An empty name removes it, so their email address is shown instead.
 */
export const setDisplayNameAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.changeProfile,
  schema: displayNameFormSchema,
  handler: async ({ input }) => {
    const { error } = await (await sessionClient()).auth.updateUser({
      data: { display_name: input.name === "" ? null : input.name },
    });
    if (error) throw new Error("The name could not be saved.", { cause: error });
    revalidatePath("/", "layout");
    return { name: input.name };
  },
});
