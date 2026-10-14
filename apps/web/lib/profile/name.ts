import { z } from "zod";
import { DISPLAY_NAME_MAX } from "./limits";

/**
 * A person's name, as the tech pack's revision history shows it (owner decision 2026-09-30).
 * It is kept in the person's own sign-in profile (Supabase Auth metadata, "display_name");
 * someone who signed in with Google may have "full_name" from Google instead. With neither,
 * the history shows their email address. The database reads the same fields
 * (supabase/migrations/20260930060000_member_names.sql).
 */

export { DISPLAY_NAME_MAX };

const CONTROL = /\p{Cc}/u;

export const displayNameFormSchema = z.object({
  name: z
    .string()
    .max(DISPLAY_NAME_MAX + 200, `A name is at most ${DISPLAY_NAME_MAX} characters.`)
    .refine((text) => !CONTROL.test(text), "Remove line breaks and hidden characters.")
    .transform((text) => text.trim())
    .refine((text) => text.length <= DISPLAY_NAME_MAX, `A name is at most ${DISPLAY_NAME_MAX} characters.`),
});

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The name in a profile's metadata, or "" when it holds none. */
export const profileNameOf = (metadata: Readonly<Record<string, unknown>> | undefined): string =>
  textOf(metadata?.display_name) || textOf(metadata?.full_name);
