"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { HOME_AFTER_SIGN_IN, SIGN_IN_PATH } from "@/lib/server/core/paths";
import { defineAction } from "@/lib/server/define-action";
import { authContext } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import {
  confirmLinkSchema,
  credentialsSchema,
  emailOnlySchema,
  newPasswordSchema,
  registrationSchema,
} from "./schemas";
import {
  confirmLink,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  startGoogleSignIn,
  updatePassword,
} from "./service";

const nothing = z.object({});

export const signUpAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.signUp,
  schema: registrationSchema,
  handler: async ({ input }) => {
    await signUp(await authContext(), input);
    return { email: input.email };
  },
});

export const signInAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.signIn,
  schema: credentialsSchema,
  handler: async ({ input }) => {
    await signIn(await authContext(), input);
    redirect(HOME_AFTER_SIGN_IN);
  },
});

export const signOutAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.signOut,
  schema: nothing,
  handler: async () => {
    await signOut(await authContext());
    redirect(SIGN_IN_PATH);
  },
});

export const requestPasswordResetAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.passwordReset,
  schema: emailOnlySchema,
  handler: async ({ input }) => {
    await requestPasswordReset(await authContext(), input);
    return { email: input.email };
  },
});

export const confirmLinkAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.confirmLink,
  schema: confirmLinkSchema,
  handler: async ({ input }) => {
    const kind = await confirmLink(await authContext(), input);
    redirect(kind === "recovery" ? "/reset-password" : HOME_AFTER_SIGN_IN);
  },
});

export const updatePasswordAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.updatePassword,
  schema: newPasswordSchema,
  handler: async ({ input }) => {
    await updatePassword(await authContext(), input);
    redirect(HOME_AFTER_SIGN_IN);
  },
});

export const startGoogleSignInAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.oauth,
  schema: nothing,
  handler: async () => {
    // The address comes from the sign-in service, so it is safe to follow.
    redirect((await startGoogleSignIn(await authContext())) as never);
  },
});
