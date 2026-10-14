import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { failureFromDatabase } from "@/lib/projects/database-errors";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import type { BotCheckOutcome } from "@/lib/share/turnstile";
import { ACCESS_MESSAGE_MAX, ACCESS_NAME_MAX, ACCESS_ORGANISATION_MAX } from "./limits";
import { ORGANISATION_TYPES, type OrganisationType } from "./organisation";

/**
 * Asking for access while sign-up is by invitation only. Anyone may ask, with no account: the
 * request is limited per address by the action, guarded by the bot check here, and kept by a
 * database function only the server's own key may run (migration 20261013030000). One request is
 * kept per email address; asking again keeps the first, and the answer is the same either way.
 * Platform admins read the requests on the leads page.
 */

export { ACCESS_MESSAGE_MAX, ACCESS_NAME_MAX, ACCESS_ORGANISATION_MAX };

const CONTROL = /\p{Cc}/u;
const CONTROL_BUT_LINES = /(?![\n\r\t])\p{Cc}/u;
const TYPE_IDS = ORGANISATION_TYPES.map((type) => type.id) as [OrganisationType, ...OrganisationType[]];
const NAME_RULE = `Enter your name, up to ${ACCESS_NAME_MAX} characters.`;

const oneLine = (max: number, rule: string) =>
  z
    .string(rule)
    .trim()
    .max(max, rule)
    .refine((text) => !CONTROL.test(text), "Remove line breaks and hidden characters.");

export const accessRequestSchema = z.object({
  name: oneLine(ACCESS_NAME_MAX, NAME_RULE).pipe(z.string().min(1, NAME_RULE)),
  email: z
    .string("Enter an email address, like name@club.com.")
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter an email address, like name@club.com.").max(320)),
  organisation: oneLine(ACCESS_ORGANISATION_MAX, `Keep the name to ${ACCESS_ORGANISATION_MAX} characters.`).default(""),
  organisationType: z
    .enum([...TYPE_IDS, ""], "Choose a type from the list.")
    .default("")
    .transform((value) => (value === "" ? null : value)),
  message: z
    .string()
    .trim()
    .max(ACCESS_MESSAGE_MAX, `Keep the message to ${ACCESS_MESSAGE_MAX} characters.`)
    .refine((text) => !CONTROL_BUT_LINES.test(text), "Remove hidden characters.")
    .default(""),
  [CAPTCHA_FIELD]: z
    .string("Complete the check to show you are a person.")
    .min(1, "Complete the check to show you are a person.")
    .max(4096),
});

export type AccessRequestInput = z.output<typeof accessRequestSchema>;
export type AccessRequest = Omit<AccessRequestInput, typeof CAPTCHA_FIELD>;

export interface AccessDeps {
  readonly botCheck: (request: Readonly<{ secret: string; token: string; address: string }>) => Promise<BotCheckOutcome>;
  /** The Turnstile secret, or null where none is set and requests are refused. */
  readonly secret: string | null;
  readonly address: string;
  readonly save: (request: AccessRequest) => Promise<string>;
  readonly notify: (requestId: string) => Promise<void>;
}

const TRY_LATER = "We could not take requests just now. Try again in a few minutes, or email us.";

/** Checks the bot check, then keeps the request and tells the team. */
export async function keepAccessRequest(deps: AccessDeps, input: AccessRequestInput): Promise<void> {
  if (deps.secret === null) throw new AppError("unavailable", TRY_LATER);
  const outcome = await deps.botCheck({ secret: deps.secret, token: input[CAPTCHA_FIELD], address: deps.address });
  if (outcome === "unreachable") throw new AppError("unavailable", TRY_LATER);
  if (outcome === "failed") {
    throw new AppError("invalid_input", MESSAGES.invalid_input, { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] });
  }
  const id = await deps.save({
    name: input.name,
    email: input.email,
    organisation: input.organisation,
    organisationType: input.organisationType,
    message: input.message,
  });
  await deps.notify(id);
}

/** Keeps one request through the database function. Returns its id, or the first request's for a known address. */
export async function saveAccessRequest(admin: SupabaseClient, request: AccessRequest): Promise<string> {
  const { data, error } = await admin.rpc("request_access", {
    p_email: request.email,
    p_name: request.name,
    p_organisation: request.organisation,
    p_organisation_type: request.organisationType ?? "",
    p_message: request.message,
  });
  if (error) throw failureFromDatabase(error);
  return z.uuid().parse(data);
}

/** One line in the server log, naming the request only: no address or message reaches the log. */
export const loggingAccessNotifier =
  (log: (event: LogEvent) => void) =>
  async (requestId: string): Promise<void> => {
    log({ level: "info", where: "access-request", message: `New access request ${requestId}. See /admin/leads.` });
  };

export interface AccessRequestRow extends AccessRequest {
  readonly id: string;
  readonly createdAt: string;
}

const rowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  organisation: z.string(),
  // An unknown type reads as none rather than failing the page.
  organisation_type: z.enum(TYPE_IDS).nullable().catch(null),
  message: z.string(),
  created_at: z.string(),
});

export const ACCESS_REQUESTS_LISTED = 50;

/** The newest requests, for platform admins. The database shows them to nobody else. */
export async function loadAccessRequests(client: SupabaseClient): Promise<AccessRequestRow[]> {
  const { data, error } = await client
    .from("access_requests")
    .select("id, email, name, organisation, organisation_type, message, created_at")
    .order("created_at", { ascending: false })
    .limit(ACCESS_REQUESTS_LISTED);
  if (error) throw failureFromDatabase(error);
  return z
    .array(rowSchema)
    .parse(data ?? [])
    .map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      organisation: row.organisation,
      organisationType: row.organisation_type,
      message: row.message,
      createdAt: row.created_at,
    }));
}
