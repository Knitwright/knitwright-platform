import { z } from "zod";
import { checkOwnerAndDue, isRealDate } from "../exceptions/rules";
import { parseSizes } from "../qc/parse";

export const shipmentFormSchema = z
  .object({
    orderId: z.uuid("That is not an order."),
    courier: z.string().trim().min(1, "Give the courier.").max(80),
    trackingNumber: z.string().trim().min(1, "Give the tracking number.").max(80),
    shippedOn: z.string().refine(isRealDate, "Give the day it was sent, year-month-day."),
    sizes: z.string().min(1, "List the pieces sent, such as M 2, L 1."),
    note: z.string().trim().max(300).default(""),
    restOwner: z.string().trim().default(""),
    restDueOn: z.string().default(""),
  })
  .transform((v, ctx) => {
    const sizes = parseSizes(v.sizes);
    if (!sizes.ok) {
      ctx.addIssue({ code: "custom", path: ["sizes"], message: sizes.problem });
      return z.NEVER;
    }
    return { orderId: v.orderId, courier: v.courier, trackingNumber: v.trackingNumber, shippedOn: v.shippedOn, sizes: sizes.value, note: v.note, restOwner: v.restOwner, restDueOn: v.restDueOn };
  });

/** The owner and date for what a parcel leaves behind, when it leaves something. */
export const restOf = (v: Readonly<{ restOwner: string; restDueOn: string }>): { owner: string; dueOn: string } | null =>
  v.restOwner === "" && v.restDueOn === "" ? null : { owner: v.restOwner, dueOn: v.restDueOn };

export const restProblem = (v: Readonly<{ restOwner: string; restDueOn: string }>): string | null => {
  const rest = restOf(v);
  return rest ? checkOwnerAndDue(rest.owner, rest.dueOn) : null;
};
