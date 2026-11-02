import { z } from "zod";
import { isRealDate } from "../exceptions/rules";

/** The form that issues a commercial invoice. Nothing on it is a figure: every number comes from a row. */
export const issueInvoiceSchema = z.object({
  orderId: z.uuid("That is not an order."),
  destinationCountry: z.string().trim().regex(/^[A-Z]{2}$/, "Choose the country the goods are going to."),
  issuedOn: z.string().refine(isRealDate, "Give the day you are issuing it, year-month-day."),
  incoterms: z.string().trim().max(40, "Keep the terms of delivery under 40 characters.").default(""),
  /** The invoice this one corrects. Empty: this is a new invoice, not a correction. */
  replacesId: z.string().trim().default(""),
});
