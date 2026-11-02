import { z } from "zod";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import { isRealDate } from "../exceptions/rules";

/** The form that asks for a third-party inspection. The provider's answer is not a field: it is recorded as given. */
export const bookInspectionSchema = z.object({
  orderId: z.uuid("That is not an order."),
  requestedOn: z.string().refine(isRealDate, "Give the day you asked, year-month-day."),
  place: z.string().trim().min(1, "Say where the goods are, such as the factory's city.").max(120),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").default(""),
  ruleId: z.string().regex(/^R-[A-Z]{2,8}-\d{3}$/, "Use a rule id such as R-GAP-000.").default(GAP_RULE_ID),
});
