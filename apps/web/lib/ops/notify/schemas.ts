import { z } from "zod";
import { EMAIL_KINDS } from "./email";

/**
 * The form that tells a customer where their order is. The words are not a field: they are written from the
 * order and its status, so nobody can type a delivery date or a promise into a message.
 */
export const statusEmailSchema = z.object({
  orderId: z.uuid("That is not an order."),
  kind: z.enum(EMAIL_KINDS, "Choose what the message is about."),
  toEmail: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Give the customer's email address.")
    .max(320, "That address is too long."),
});
