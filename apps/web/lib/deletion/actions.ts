"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/service";
import { SIGN_IN_PATH } from "@/lib/server/core/paths";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, authContext } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { deleteAccountSchema, deleteDesignSchema } from "./schemas";
import { deleteAccount, deleteDesign } from "./service";

/**
 * Deleting cannot be undone. The brand and the user come from the session, never from the form,
 * and the database checks both again.
 */

/** Deletes a design in the brand the user is working in, with the pictures only it uses. */
export const deleteDesignAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.deleteDesign,
  schema: deleteDesignSchema,
  handler: async ({ input, session }) => {
    await deleteDesign(adminClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      projectId: input.projectId,
    });
    revalidatePath("/studio");
    redirect("/studio");
  },
});

/** Deletes the signed-in user's account and everything it owns, then signs them out. */
export const deleteAccountAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.deleteAccount,
  schema: deleteAccountSchema,
  handler: async ({ session }) => {
    await deleteAccount(adminClient(), { userId: session.userId });
    try {
      // The user no longer exists, so the sign-in service may refuse; the cookies go either way.
      await signOut(await authContext());
    } catch (error) {
      log({ level: "warn", message: "Sign-out after account deletion was refused", where: "delete-account", error });
    }
    redirect(`${SIGN_IN_PATH}?notice=account-deleted` as Route);
  },
});
