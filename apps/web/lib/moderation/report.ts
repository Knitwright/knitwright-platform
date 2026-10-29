import { z } from "zod";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { BotCheckOutcome } from "@/lib/share/turnstile";

/**
 * The public rights-holder report (F-G1 notice and takedown). Anyone may report with no account: the action limits it per
 * address, the bot check guards it here, and a database function only the server's key may run keeps it. Nothing is fetched
 * from the link a reporter gives; it is kept as text for ops to read.
 */
export const REPORT_LIMITS = { name: 200, email: 320, holder: 200, mark: 200, location: 500, details: 2000 } as const;

const CONTROL = /\p{Cc}/u;
const CONTROL_BUT_LINES = /(?![\n\r\t])\p{Cc}/u;

const oneLine = (max: number, rule: string) =>
  z
    .string(rule)
    .trim()
    .min(1, rule)
    .max(max, rule)
    .refine((text) => !CONTROL.test(text), "Remove line breaks and hidden characters.");

export const reportSchema = z.object({
  reporterName: oneLine(REPORT_LIMITS.name, `Enter your name, up to ${REPORT_LIMITS.name} characters.`),
  reporterEmail: z
    .string("Enter an email address, like name@company.com.")
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter an email address, like name@company.com.").max(REPORT_LIMITS.email)),
  holder: oneLine(REPORT_LIMITS.holder, "Name the owner of the mark or work."),
  mark: oneLine(REPORT_LIMITS.mark, "Name the mark or work, such as a logo or a brand name."),
  location: oneLine(REPORT_LIMITS.location, "Say where you saw it: a link or a product name."),
  details: z
    .string()
    .trim()
    .max(REPORT_LIMITS.details, `Keep the details to ${REPORT_LIMITS.details} characters.`)
    .refine((text) => !CONTROL_BUT_LINES.test(text), "Remove hidden characters.")
    .default(""),
  goodFaith: z.literal("yes", "Confirm that you own the mark or act for its owner."),
  [CAPTCHA_FIELD]: z
    .string("Complete the check to show you are a person.")
    .min(1, "Complete the check to show you are a person.")
    .max(4096),
});

export type ReportInput = z.output<typeof reportSchema>;
export type Report = Omit<ReportInput, typeof CAPTCHA_FIELD | "goodFaith">;

export interface ReportDeps {
  readonly botCheck: (request: Readonly<{ secret: string; token: string; address: string }>) => Promise<BotCheckOutcome>;
  /** The Turnstile secret, or null where none is set and reports are refused. */
  readonly secret: string | null;
  readonly address: string;
  readonly save: (report: Report) => Promise<string>;
}

const TRY_LATER = "We could not take reports just now. Try again in a few minutes, or email us.";

/** Checks the bot check, then keeps the report. */
export async function submitReport(deps: ReportDeps, input: ReportInput): Promise<string> {
  if (deps.secret === null) throw new AppError("unavailable", TRY_LATER);
  const outcome = await deps.botCheck({ secret: deps.secret, token: input[CAPTCHA_FIELD], address: deps.address });
  if (outcome === "unreachable") throw new AppError("unavailable", TRY_LATER);
  if (outcome === "failed") {
    throw new AppError("invalid_input", MESSAGES.invalid_input, { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] });
  }
  return deps.save({
    reporterName: input.reporterName,
    reporterEmail: input.reporterEmail,
    holder: input.holder,
    mark: input.mark,
    location: input.location,
    details: input.details,
  });
}
