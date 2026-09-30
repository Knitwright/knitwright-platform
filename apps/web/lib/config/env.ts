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
  // AI spend allowances for each calendar month (UTC), in microdollars (millionths of a US
  // dollar). A limit stored in usage_limits for one user or brand replaces these. The
  // defaults are provisional (30 times the earlier daily ones): the owner sets the real
  // ones (see lib/usage/OWNER-QUESTIONS.md).
  USAGE_USER_MONTHLY_AI: microdollars.default(7_500_000),
  USAGE_BRAND_MONTHLY_AI: microdollars.default(30_000_000),
  USAGE_USER_MONTHLY_PHOTOREAL: microdollars.default(15_000_000),
  USAGE_BRAND_MONTHLY_PHOTOREAL: microdollars.default(60_000_000),
  // Safety ceiling across every user for each UTC day (not a month: it guards against a
  // runaway spend). The owner is alerted at half and at full.
  USAGE_GLOBAL_DAILY_CEILING: microdollars.default(25_000_000),
  // AI provider keys (owner action A3). Both are optional: without the key for the chosen
  // model the assistant is shown as not available, and requests the rules can answer still work.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  // The model tried first, and the stronger one tried once before a question is asked.
  // Chosen by the selection run in docs/evals (owed until the keys exist).
  INTENT_MODEL: z.enum(MODEL_IDS).default(DEFAULT_MODEL),
  INTENT_RETRY_MODEL: z.enum(MODEL_IDS).default(DEFAULT_RETRY_MODEL),
  // The image model for photoreal pictures (plan step 14). Optional: without it the
  // feature is shown as unavailable. Server only. It must belong to a Google project with
  // billing on: on the free tier Google may train on what is sent. See docs/data-processing.md.
  GEMINI_API_KEY: z.string().regex(/^\S{1,200}$/).optional(),
  // Browser tests only: "on" answers the assistant with a stand-in that never reaches the
  // network (lib/providers/stand-in.ts). Refused wherever real people sign in.
  AI_PROVIDER_STUB: z.enum(["on", "off"]).optional(),
  // The button is shown only when this is exactly "true".
  GOOGLE_SIGN_IN: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  // Read only to refuse Cloudflare's test keys where real people sign in.
  NODE_ENV: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
});

/**
 * Cloudflare's published Turnstile test site keys. They pass (or fail) everyone, so
 * they may never reach a deploy.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TURNSTILE_TEST_SITE_KEYS: ReadonlySet<string> = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
]);

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * A Vercel production deploy, or a production build served anywhere but this machine.
 * `next start` always runs as production, so the browser tests, which serve the build
 * on localhost, are told apart by their address.
 */
const servesRealPeople = (env: z.infer<typeof envSchema>): boolean =>
  env.VERCEL_ENV === "production" ||
  (env.NODE_ENV === "production" && !LOOPBACK_HOSTS.has(new URL(env.NEXT_PUBLIC_SITE_URL).hostname));

const guardedSchema = envSchema.superRefine((env, context) => {
  if (TURNSTILE_TEST_SITE_KEYS.has(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && servesRealPeople(env)) {
    context.addIssue({
      code: "custom",
      path: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
      message: "test key",
    });
  }
  if (env.AI_PROVIDER_STUB === "on" && servesRealPeople(env)) {
    context.addIssue({ code: "custom", path: ["AI_PROVIDER_STUB"], message: "test key" });
  }
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
  if (issue.code === "custom" && name === "AI_PROVIDER_STUB") return `${name} is for browser tests, which a deploy may not use`;
  if (issue.code === "custom") return `${name} is a test key, which a deploy may not use`;
  const missing = issue.code === "invalid_type" && issue.input === undefined;
  return missing ? `${name} is missing` : `${name} is not valid`;
};

export const parseEnv = (source: EnvSource): Env => {
  const result = guardedSchema.safeParse(withoutEmptyStrings(source));
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
