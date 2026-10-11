"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/server/core/errors";
import { HOME_AFTER_SIGN_IN } from "@/lib/server/core/paths";
import { defineAction } from "@/lib/server/define-action";
import { currentBrands, rememberActiveBrand, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { setBrandDetails } from "@/lib/leads/service";
import { log } from "@/lib/server/log";
import { brandNameFormSchema, newBrandFormSchema, switchBrandSchema } from "./schemas";
import { createBrand, renameBrand } from "./service";

/**
 * Runs before a brand exists, so it needs a session only. The organisation details are optional
 * (decision 0024); the brand is made first, so a failure to store them is logged and asked again
 * when a design is saved.
 */
export const createBrandAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.createBrand,
  schema: newBrandFormSchema,
  handler: async ({ input }) => {
    const client = await sessionClient();
    const { name, ...details } = input;
    const brand = await createBrand(client, name);
    if (Object.values(details).some((value) => value !== null)) {
      await setBrandDetails(client, brand.id, details).catch((error: unknown) =>
        log({ level: "warn", message: "The organisation details could not be saved", where: "action create-brand", error }),
      );
    }
    await rememberActiveBrand(brand.id);
    redirect(HOME_AFTER_SIGN_IN);
  },
});

/** Changes which of the user's brands they are working in. */
export const switchBrandAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.changeBrand,
  schema: switchBrandSchema,
  handler: async ({ input }) => {
    const brands = await currentBrands();
    if (!brands.some((brand) => brand.id === input.brandId)) {
      throw new AppError("not_found", "That brand does not exist.");
    }
    await rememberActiveBrand(input.brandId);
    redirect(HOME_AFTER_SIGN_IN);
  },
});

/** Renames the brand the user is working in. */
export const renameBrandAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.changeBrand,
  schema: brandNameFormSchema,
  handler: async ({ input, session }) => {
    await renameBrand(await sessionClient(), session.brand.id, input.name);
    revalidatePath("/", "layout");
    return { name: input.name };
  },
});
