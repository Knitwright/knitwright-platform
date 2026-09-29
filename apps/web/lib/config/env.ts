import { z } from "zod";
import { DEFAULT_MODEL, DEFAULT_RETRY_MODEL, MODEL_IDS } from "@/lib/providers/catalog";

/**
 * Environment contract. Every variable the app reads is declared here, so a
 * missing or malformed value stops the server at start-up with one message
 * instead of failing later inside a request.
 */
/** A whole, non-negative amount of microdollars, written as digits. */
const microdollars = z.string().regex(/^\d{1,15}$/).transform(Number);

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Full database access. Read on the server only, never sent to a browser.
  SUPABASE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  // May register while sign-up is closed. The switch itself lives in the database.
  OWNER_EMAIL: z
    .email()
    .transform((value) => value.toLowerCase())
    .optional(),
  // The header in which the host writes the caller's address. No other header is
  // trusted. The default is right for Vercel. Locally it is x-real-ip.
  CLIENT_ADDRESS_HEADER: z
    .string()
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toLowerCase())
    .default("x-vercel-forwarded-for"),
  // AI spend allowances for each UTC day, in microdollars (millionths of a US dollar).
  // A limit stored in usage_limits for one user or brand replaces these. The defaults
  // are provisional: the owner sets the real ones (see lib/usage/OWNER-QUESTIONS.md).
  USAGE_USER_DAILY_AI: microdollars.default(250_000),
  USAGE_BRAND_DAILY_AI: microdollars.default(1_000_000),
  USAGE_USER_DAILY_PHOTOREAL: microdollars.default(500_000),
  USAGE_BRAND_DAILY_PHOTOREAL: microdollars.default(2_000_000),
  // Safety ceiling across every user. The owner is alerted at half and at full.
  USAGE_GLOBAL_DAILY_CEILING: microdollars.default(25_000_000),
  // AI provider keys (owner action A3). Both are optional: without the key for the chosen
  // model the assistant is shown as not available, and requests the rules can answer still work.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  // The model tried first, and the stronger one tried once before a question is asked.
  // Chosen by the selection run in docs/evals (owed until the keys exist).
  INTENT_MODEL: z.enum(MODEL_IDS).default(DEFAULT_MODEL),
  INTENT_RETRY_MODEL: z.enum(MODEL_IDS).default(DEFAULT_RETRY_MODEL),
  // The button is shown only when this is exactly "true".
  GOOGLE_SIGN_IN: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `Invalid environment. Fix these variables and restart:\n${problems
        .map((problem) => `  - ${problem}`)
        .join("\n")}`,
    );
    this.name = "EnvError";
  }
}

type EnvSource = Readonly<Record<string, string | undefined>>;

const withoutEmptyStrings = (source: EnvSource): EnvSource =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));

/** Values are never included in problems: a malformed secret must not reach a log. */
const describeIssue = (issue: z.core.$ZodIssue): string => {
  const name = issue.path.join(".") || "(root)";
  const missing = issue.code === "invalid_type" && issue.input === undefined;
  return missing ? `${name} is missing` : `${name} is not valid`;
};

export const parseEnv = (source: EnvSource): Env => {
  const result = envSchema.safeParse(withoutEmptyStrings(source));
  if (!result.success) {
    throw new EnvError(result.error.issues.map(describeIssue));
  }
  return result.data;
};

let cached: Env | undefined;

export const getEnv = (): Env => {
  cached ??= parseEnv(process.env);
  return cached;
};
