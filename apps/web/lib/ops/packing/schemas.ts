import { z } from "zod";
import { emptyToNull } from "@/lib/server/empty-to-null";

const optionalInt = (label: string, max: number) =>
  z.preprocess(emptyToNull, z.coerce.number().int(`${label}: whole numbers only.`).min(1, `${label}: more than 0.`).max(max, `${label}: at most ${max}.`).nullable().default(null));

export const orderOnly = z.object({ orderId: z.uuid("That is not an order.") });

/** Weight in kilograms is typed as grams, sizes in millimetres. Left empty means "not set": nothing is assumed. */
export const cartonFormSchema = orderOnly.extend({
  cartonNo: z.coerce.number().int("Whole numbers only.").min(1, "Carton numbers start at 1.").max(999),
  weightG: optionalInt("Weight in grams", 1_000_000),
  lengthMm: optionalInt("Length in mm", 5000),
  widthMm: optionalInt("Width in mm", 5000),
  heightMm: optionalInt("Height in mm", 5000),
});

export const packBagFormSchema = orderOnly.extend({
  bagId: z.uuid("That is not a bag."),
  cartonNo: z.coerce.number().int().min(1, "Choose a carton.").max(999),
});
