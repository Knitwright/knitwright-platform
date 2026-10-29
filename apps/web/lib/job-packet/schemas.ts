import { z } from "zod";
import { emptyToNull } from "@/lib/server/empty-to-null";
import { WHATSAPP_NUMBER } from "./notify";
import { DEFAULT_PACKET_DAYS, FACTORY_STEPS, MAX_PACKET_DAYS, NOTE_MAX } from "./steps";

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export const tokenSchema = z.string().regex(TOKEN_SHAPE, "That link does not exist.");

const note = z.string().trim().max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters.`).default("");

/** A step button on the factory's page. */
export const stepFormSchema = z.object({ token: tokenSchema, step: z.enum(FACTORY_STEPS, "Choose a step."), note });

/** The note box on the factory's page. */
export const noteFormSchema = z.object({
  token: tokenSchema,
  note: z.string().trim().min(1, "Write the note first.").max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters.`),
});

/** The photo form: one file and an optional caption. */
export const photoFormSchema = z.looseObject({ photo: z.instanceof(File, { message: "Choose a photo." }), note });

const whatsapp = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(WHATSAPP_NUMBER, "Give the number in international form, such as +923001234567."))
    .nullable()
    .default(null),
);

const days = z.preprocess(
  emptyToNull,
  z.coerce.number().int("Whole days only.").min(1, "At least 1 day.").max(MAX_PACKET_DAYS, `At most ${MAX_PACKET_DAYS} days.`).nullable().default(null),
);

/** Ops makes the batch's link. */
export const createPacketSchema = z
  .object({ batchId: z.uuid("That is not a batch."), whatsapp, days })
  .transform((v) => ({ ...v, days: v.days ?? DEFAULT_PACKET_DAYS }));

/** Ops sends the link again: a new address, a new expiry. */
export const resendPacketSchema = z
  .object({ batchId: z.uuid("That is not a batch."), packetId: z.uuid("That is not a factory link."), whatsapp, days })
  .transform((v) => ({ ...v, days: v.days ?? DEFAULT_PACKET_DAYS }));

export const revokePacketSchema = z.object({ batchId: z.uuid("That is not a batch."), packetId: z.uuid("That is not a factory link.") });
