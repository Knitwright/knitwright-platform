import { z } from "zod";

import { MARKETING_FIELD } from "./fields";

export { MARKETING_FIELD };

/** The box in Settings: ticked sends "yes", unticked sends nothing. */
export const marketingChoiceSchema = z
  .object({ [MARKETING_FIELD]: z.literal("yes").optional() })
  .transform((value) => ({ granted: value[MARKETING_FIELD] === "yes" }));

/**
 * The Google button. On the sign-up page it carries the box's state as "yes" or "no"; on the
 * sign-in page it carries nothing, because nothing was asked there.
 */
export const googleSignUpSchema = z
  .object({ [MARKETING_FIELD]: z.enum(["yes", "no"]).optional() })
  .transform((value) => ({ marketing: value[MARKETING_FIELD] === undefined ? null : value[MARKETING_FIELD] === "yes" }));

/** Holds the sign-up choice in a short-lived cookie while Google signs the person in. */
export const SIGNUP_CHOICE_COOKIE = "kw-signup-marketing";
export const SIGNUP_CHOICE_MAX_AGE_SECONDS = 10 * 60;

export const signupChoiceValue = (granted: boolean): string => (granted ? "yes" : "no");

export const parseSignupChoice = (value: string | undefined): boolean | null => {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
};

export const unsubscribeSchema = z.object({ token: z.string().min(1).max(512) });
