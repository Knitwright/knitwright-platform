import { z } from "zod";
import { DELAY_REASON_MAX } from "./status";

const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);
const note = z.string().trim().max(300, "Keep the note under 300 characters.").default("");

export const orderIdSchema = z.object({ orderId: z.uuid("That is not an order.") });

export const statusFormSchema = orderIdSchema.extend({ to: z.enum(["received", "in_production", "ready"], "Choose the next step.") });

export const holdFormSchema = orderIdSchema.extend({
  hold: z.enum(["true", "false"]).transform((v) => v === "true"),
  note,
});

export const moveFormSchema = orderIdSchema.extend({ batchId: z.uuid("Choose a batch."), note });

export const delayFormSchema = orderIdSchema.extend({
  promisedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Give the new promised date, year-month-day."),
  reason: z.string().trim().min(1, "Give the reason for the delay.").max(DELAY_REASON_MAX, `Keep the reason under ${DELAY_REASON_MAX} characters.`),
});

export const cutFormSchema = z.object({});

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const settingsFormSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    time: z.string().regex(TIME, "Give the cut-off time as hours and minutes, such as 17:00."),
    leadTimeDays: z.preprocess(emptyToNull, z.coerce.number().int("Whole days only.").min(0).max(365).nullable().default(null)),
    label: z.string().trim().min(1, "Say where these settings come from.").max(120),
  })
  .transform(({ weekday, time, leadTimeDays, label }) => {
    const [hh, mm] = time.split(":").map(Number);
    return { cutoffWeekday: weekday, cutoffMinutes: (hh ?? 0) * 60 + (mm ?? 0), leadTimeDays, label };
  });
