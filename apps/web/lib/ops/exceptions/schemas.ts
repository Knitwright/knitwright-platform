import { z } from "zod";
import { parseSizes } from "../qc/parse";
import { EXCEPTION_KINDS, NOTE_MAX, OWNER_MAX, isRealDate } from "./rules";

const owner = z.string().trim().min(1, "Give an owner, a name.").max(OWNER_MAX, `Keep the owner under ${OWNER_MAX} characters.`);
const dueOn = z.string().refine(isRealDate, "Give the due date as a real date, year-month-day.");
const note = z.string().trim().max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters.`).default("");

export const raiseFormSchema = z
  .object({
    orderId: z.uuid("That is not an order."),
    kind: z.enum(EXCEPTION_KINDS, "Choose what happened."),
    owner,
    dueOn,
    note,
    sizes: z.string().default(""),
  })
  .transform((v, ctx) => {
    if (v.kind !== "remake") return { orderId: v.orderId, kind: v.kind, owner: v.owner, dueOn: v.dueOn, note: v.note, detail: {} as Record<string, number> };
    const parsed = parseSizes(v.sizes);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", path: ["sizes"], message: parsed.problem });
      return z.NEVER;
    }
    return { orderId: v.orderId, kind: v.kind, owner: v.owner, dueOn: v.dueOn, note: v.note, detail: { ...parsed.value } };
  });

export const updateFormSchema = z.object({ exceptionId: z.uuid("That is not an exception."), orderId: z.uuid(), owner, dueOn, note });

export const resolveFormSchema = z.object({
  exceptionId: z.uuid("That is not an exception."),
  orderId: z.uuid(),
  resolution: z.string().trim().min(1, "Say how it was resolved.").max(NOTE_MAX, `Keep it under ${NOTE_MAX} characters.`),
});
