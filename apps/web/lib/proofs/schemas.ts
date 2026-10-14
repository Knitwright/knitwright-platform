import { z } from "zod";
import { cleanName } from "@/lib/orders/text";
import { SIGN_OFF_ROLES } from "./types";

/** A person's name or role as typed: cleaned, and limited to what is safe to show and to put in a file. */
const typed = (what: string) =>
  z
    .string()
    .max(200)
    .transform((raw, ctx) => {
      const cleaned = cleanName(raw);
      if (!cleaned.ok || cleaned.name === "") {
        ctx.addIssue({ code: "custom", message: `Enter ${what}: letters, digits, spaces and the marks ' - . & only, up to 40 characters.` });
        return z.NEVER;
      }
      return cleaned.name;
    });

const note = (max: number) => z.string().trim().max(max).default("");

const DAY_MS = 86_400_000;
const date = z.iso.date().refine((d) => Date.parse(d) <= Date.now() + DAY_MS, "A date cannot be in the future.");
/** Today in UTC, as the date a record is made on when nobody types one. */
export const today = (now: Date): string => now.toISOString().slice(0, 10);

export const requestStrikeOffBody = z.object({ note: note(500) });

const pct = z.number().min(0, "Shrink cannot be below 0.").max(30, "Shrink above 30 percent is not possible.").multipleOf(0.01);

export const receiveStrikeOffBody = z.object({
  shrinkLengthPct: pct.nullable(),
  shrinkWidthPct: pct.nullable(),
  colourNotes: z.array(z.object({ colour: z.string().trim().min(1).max(40), note: z.string().trim().min(1).max(300) })).max(20),
  photoFileIds: z.array(z.uuid()).max(6),
});

export const decideStrikeOffBody = z.object({
  accept: z.boolean(),
  name: typed("your name"),
  role: typed("your role"),
  on: date.optional(),
  note: note(500),
});

export const signOffBody = z.object({
  role: z.enum(SIGN_OFF_ROLES),
  name: typed("the name of the person signing"),
  signedOn: date.optional(),
  note: note(300),
});
