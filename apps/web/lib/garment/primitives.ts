import { z } from "zod";

export const WEARERS = ["men", "women", "youth"] as const;
export const wearerSchema = z.enum(WEARERS);
export type Wearer = z.output<typeof wearerSchema>;

export const FAMILY_IDS = ["tops", "bottoms", "outerwear", "close-fitting", "football", "cricket", "winter-code"] as const;
export const familySchema = z.enum(FAMILY_IDS);
export type FamilyId = z.output<typeof familySchema>;

const KEBAB_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const LOCAL_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const CONTROL_CHARACTER = /\p{Cc}/u;

const ID_MAX_LENGTH = 64;
const LABEL_MAX_LENGTH = 200;
const SENTENCE_MAX_LENGTH = 500;

/** An id written in registry data, such as `crew-tee`. */
export const kebabId = z
  .string()
  .max(ID_MAX_LENGTH)
  .regex(KEBAB_PATTERN, "Use lower case words joined by dashes.");

/** An id chosen by the caller for a colourway or artwork. A uuid fits. */
export const localId = z
  .string()
  .min(1)
  .max(ID_MAX_LENGTH)
  .regex(LOCAL_ID_PATTERN, "Use letters, numbers, dashes and underscores only.");

/**
 * Text typed by a person. It is trimmed and limited in length, and it is never
 * interpreted. Control characters such as line breaks are refused.
 */
export function freeText(maxLength: number): z.ZodString {
  return z
    .string()
    .trim()
    .max(maxLength, `Use ${maxLength} characters or fewer.`)
    .refine((text) => !CONTROL_CHARACTER.test(text), "Remove line breaks and hidden characters.");
}

/** A label written in registry data for a screen to show. */
export const labelText = z.string().trim().min(1).max(LABEL_MAX_LENGTH);

/** A sentence or two written in registry data, such as how to measure something. */
export const sentenceText = z.string().trim().min(1).max(SENTENCE_MAX_LENGTH);
